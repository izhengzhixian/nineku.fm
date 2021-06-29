import * as keypress from 'keypress';

export enum KeyPressEvent {
    KEYPRESS = "keypress",
}

export enum TerminalEvent {
    RESIZE = "resize",
}

export class Key {
    name = "";
    ctrl = false;
    meta = false;
    shift = false;
}

export enum Color {
    BLACK = 30,
    RED = 31,
    GREEN = 32,
    YELLOW = 33,
    BLUE = 34,
    WHITE = 37,
}

export declare type keypressCallback = (key: Key) => void;
export declare type terminalEventCallback
    = (width: number, height: number) => void;

export class Terminal {
    _keypress_hooks = new Map<KeyPressEvent, keypressCallback>();
    _terminal_event_hooks = new Map<TerminalEvent, terminalEventCallback>();

    addKeyPressHook(event: KeyPressEvent, callback: keypressCallback) {
        this._keypress_hooks.set(event, callback);
    }

    addTerminalHook(event: TerminalEvent, callback: terminalEventCallback) {
        this._terminal_event_hooks.set(event, callback);
    }

    run() {
        keypress(process.stdin);
        this._keypress_hooks.forEach((callback, event) => {
            process.stdin.on(event, (ch, key) => {
                if (!key) {
                    key = new Key();
                    key.name = ch;
                }
                callback(key);
            });
        });
        this._terminal_event_hooks.forEach((callback, event) => {
            process.stdout.on(event, () => {
                callback(this.getWidth(), this.getHeight());
            });
        });
        process.stdin.setRawMode(true);
        process.stdin.resume();
    }

    getWidth(): number {
        return process.stdout.columns;
    }

    getHeight(): number {
        return process.stdout.rows;
    }

    hiddenCursor() {
        console.log("\x1b[?25l");
    }

    displayCursor() {
        console.log("\x1b[?25h");
    }

    colorData(color: Color, data = ""): string {
        return `\x1b[20;${color}m${data}\x1b[0m`;
    }

    colorDataLength(data: string): number {
        data = data.replace(/\x1b\[[0-9]+(;[0-9]+)*m/g, "");
        let length = data.length;
        let n = 1;
        for (let i = 0; i < length; i++) {
            if (/[\u4e00-\u9fa5]/.test(data[i])) {
                n++;
            }
        }
        return n + length;
    }

    clearConsole() {
        process.stdout.cursorTo(0, 0);
        process.stdout.clearScreenDown();
    }

    log(message?: any, ...optionParams: any[]) {
        console.log(message, ...optionParams);
    }
}
