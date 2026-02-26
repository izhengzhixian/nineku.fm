import cp from 'child_process';
import events from 'events';
import fs from 'fs';
import net from 'net';
import prexit from 'prexit';

export interface MpvOptions {
  args?: string[];
  options?: cp.SpawnOptions;
  stdout?: (data: string) => void;
  path?: string;
}

interface MpvRequest {
  id: number;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  args: any[];
  message: string;
}

interface MpvObserver {
  id: number;
  fns: Set<(data: any) => void>;
}

export interface MpvInstance extends events.EventEmitter {
  process: cp.ChildProcess;
  status: 'closed' | 'starting' | 'started' | 'errored';
  socket: net.Socket;
  end: () => void;
  set: (property: string, value: any) => Promise<any>;
  get: (property: string) => Promise<any>;
  command: (cmd: string, ...args: any[]) => Promise<any>;
  observe: (property: string, fn: (value: any) => void) => Promise<() => void>;
}

export default async function Mpv({
  args = [],
  options = {},
  stdout,
  path = process.platform === 'win32'
    ? fs.existsSync('mpv.exe') ? 'mpv.exe' : 'mpv'
    : fs.existsSync('mpv') ? './mpv' : 'mpv'
}: MpvOptions = {}): Promise<MpvInstance> {
  
  const socketArg = '--input-ipc-server';
  const socket = new net.Socket();
  
  // 初始化 EventEmitter 并扩展属性
  const mpv = new events.EventEmitter() as MpvInstance;
  
  Object.assign(mpv, {
    end,
    status: 'closed' as const,
    set: (prop: string, val: any) => command('set_property', prop, val),
    get: (prop: string) => command('get_property', prop),
    command,
    observe,
    socket
  });

  const observers = new Map<string, MpvObserver | Promise<MpvObserver>>();
  const requests = new Map<number, MpvRequest>();

  let observeId = 0;
  let requestId = 0;
  let queue: MpvRequest[] = [];

  const finalArgs = (args || []).slice(0);

  const defaults = [
    randomPath(),
    '--audio-fallback-to-null=yes',
    '--no-config',
    '--idle',
    '--msg-level=all=error'
  ];

  defaults.forEach(a => {
    const key = a.split('=')[0];
    if (!finalArgs.some(x => x.startsWith(key))) {
      finalArgs.push(a);
    }
  });

  const socketMatch = finalArgs.find(x => x.startsWith(socketArg));
  const socketPath = socketMatch ? socketMatch.slice(socketArg.length + 1) : '';

  socket
    .unref()
    .setEncoding('utf8')
    .on('error', (e) => error(e))
    .on('data', (d) => data(d.toString()));

  prexit.last(end);

  await start();

  return mpv;

  function end() {
    if (mpv.process) {
      mpv.process.removeAllListeners();
      kill();
      mpv.process.unref();
    }
  }

  function kill() {
    if (mpv.process && !mpv.process.killed) {
      mpv.process.kill();
    }
  }

  function error(e: Error) {
    if (mpv.status === 'started') kill();
  }

  async function start() {
    if (mpv.status !== 'closed') return;

    mpv.status = 'starting';

    try {
      if (mpv.process) end();
      
      const child = cp.spawn(path, finalArgs, options);
      mpv.process = child;

      let stderr = '';

      child.stdout?.setEncoding('utf8');
      child.stderr?.setEncoding('utf8');
      
      child.stdout?.on('data', stdout || ((data) => console.log(data)));
      child.stderr?.on('data', (x) => stderr = (stderr + x).slice(-10000));

      await new Promise<void>((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (code, signal) => 
          reject(Object.assign(new Error(stderr || 'closed'), { code, signal }))
        );
        connect().then(resolve, reject);
      });

      ready();
      mpv.status = 'started';
      mpv.emit('started');
      
      child.on('close', () => {
        mpv.status = 'closed';
        mpv.emit('closed');
        start().catch(e => mpv.emit('error', e));
      });
    } catch (err) {
      mpv.status = 'errored';
      throw err;
    }
  }

  async function connect({
    connectStart = Date.now(),
    timeout = 5000
  } = {}): Promise<void> {
    let err: Error | null = null;

    return new Promise<void>((resolve, reject) => {
      const onReady = () => {
        cleanup();
        resolve();
      };

      const onError = (e: Error) => {
        err = e;
      };

      const onClose = () => {
        if (Date.now() - connectStart > timeout) {
          cleanup();
          reject(err || new Error('Timed out'));
        } else {
          setTimeout(() => socket.connect(socketPath), 20);
        }
      };

      const cleanup = () => {
        socket.off('ready', onReady);
        socket.off('error', onError);
        socket.off('close', onClose);
      };

      socket.once('ready', onReady);
      socket.on('error', onError);
      socket.on('close', onClose);
      socket.connect(socketPath);
    });
  }

  async function observe(x: string, fn: (data: any) => void): Promise<() => void> {
    if (observers.has(x)) {
      const entry = await observers.get(x)!;
      entry.fns.add(fn);
      return () => unobserve(x, fn);
    }

    const id = ++observeId;
    const promise = mpv.command('observe_property', id, x).then(result => {
      const entry = { id, fns: new Set([fn]) };
      observers.set(x, entry);
      return entry;
    });

    observers.set(x, promise);
    await promise;
    return () => unobserve(x, fn);
  }

  async function unobserve(x: string, fn: (data: any) => void) {
    const entry = observers.get(x);
    if (!entry || entry instanceof Promise) return;

    entry.fns.delete(fn);
    if (entry.fns.size === 0) {
      observers.delete(x);
      mpv.command('unobserve_property', entry.id).catch(e => mpv.emit('error', e));
    }
  }

  function ready() {
    observers.forEach(async (val, key) => {
      const entry = await val;
      command('observe_property', entry.id, key);
    });
    requests.forEach(write);
    queue.forEach(write);
    queue = [];
  }

  function data(x: string) {
    x.split(/\r?\n/g)
     .filter(line => line.trim())
     .map(line => JSON.parse(line))
     .forEach(handle);
  }

  function handle(x: any) {
    if (x.event) {
      if (x.event === 'property-change') {
        const observer = observers.get(x.name);
        if (observer && !(observer instanceof Promise)) {
          observer.fns.forEach(fn => fn(x.data));
        }
      } else {
        mpv.emit(x.event, x);
      }
      return;
    }

    const request = requests.get(x.request_id);
    if (!request) {
      if (x.error !== 'success') {
        mpv.emit('error', Object.assign(new Error(x.error), x));
      }
      return;
    }

    requests.delete(x.request_id);

    if (x.error === 'success') {
      request.resolve(x.data);
    } else {
      request.reject(new Error(`${request.args.join(' ')} - failed with error: ${x.error}`));
    }
  }

  async function command(...args: any[]): Promise<any> {
    const stackErr = new Error();
    Error.captureStackTrace(stackErr, command);

    try {
          return await new Promise((resolve, reject) => {
              const id = ++requestId;
              const request: MpvRequest = {
                  id,
                  resolve,
                  reject,
                  args,
                  message: JSON.stringify({
                      request_id: id,
                      command: args.filter(x => x !== undefined)
                  }) + '\n'
              };

              socket.readyState === 'open'
                  ? write(request)
                  : queue.push(request);
          });
      } catch (e) {
          stackErr.message = e instanceof Error ? e.message : String(e);
          throw stackErr;
      }
  }

  function write(request: MpvRequest) {
    socket.write(request.message);
    requests.set(request.id, request);
  }

  function randomPath() {
    return socketArg + '='
         + (process.platform === 'win32' ? '\\\\.\\pipe\\mpvsocket' : '/tmp/mpvsocket')
         + Math.random().toString(36).slice(2);
  }
}