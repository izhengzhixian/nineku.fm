import mpv, { MpvInstance } from './mpv';

declare type closeCallback = () => void;

export default class SoundPlayer {
    private _mpv: MpvInstance | null = null;
    private _play = false;
    private _volume_rate = 100;
    private _callback: closeCallback | null = null;
    private _uri = "";

    constructor(volume_rate: number) {
        this._volume_rate = volume_rate;
    }

    setCloseCallback(callback: closeCallback) {
        this._callback = callback;
    }

    private _closeCallback() {
        if (this._callback) {
            const callback = this._callback;
            this._callback = null;
            callback();
        }
    }

    /**
     * Ensure there is an mpv instance available. Creates one if necessary.
     */
    private async _ensureMpv(): Promise<MpvInstance> {
        if (this._mpv && this._mpv.status !== 'closed') {
            return this._mpv;
        }
        this._mpv = await mpv();
        // when the file ends, notify the close callback
        this._mpv.on('end-file', () => {
            // mpv may emit multiple end-file events; only trigger once
            this._closeCallback();
        });
        return this._mpv;
    }

    /**
     * Load a URI into mpv. The file will be paused after loading; call start() to begin playback.
     */
    async load(uri: string) {
        this.close(); // dispose previous player if any
        this._uri = uri;

        const player = await this._ensureMpv();
        // load the resource (mpv will start playing immediately)
        await player.command('loadfile', uri, 'replace');
        // apply volume setting
        await player.set('volume', this._volume_rate);
        // pause until explicit start
        await player.set('pause', true);
    }

    start(): boolean {
        if (this._play || !this._mpv) return false;

        this._play = true;
        // un-pause player
        this._mpv.set('pause', false).catch(() => {});
        return true;
    }

    pause() {
        if (!this._play || !this._mpv) return false;

        this._play = false;
        this._mpv.set('pause', true).catch(() => {});
        return true;
    }

    getVolume(): number {
        return this._volume_rate;
    }

    upVolume() {
        this._volume_rate = Math.min(this._volume_rate + 1, 125);
        if (this._mpv) {
            this._mpv.set('volume', this._volume_rate).catch(() => {});
        }
    }

    downVolume() {
        this._volume_rate = Math.max(this._volume_rate - 1, 0);
        if (this._mpv) {
            this._mpv.set('volume', this._volume_rate).catch(() => {});
        }
    }

    isPlay() {
        return this._play;
    }

    hasMusic() {
        return !!this._mpv && this._uri !== "";
    }

    close() {
        if (this._mpv) {
            // stop playback and teardown mpv process
            this._mpv.command('stop').catch(() => {});
            this._mpv.end();
            this._mpv = null;
        }
        this._play = false;
        this._uri = "";
    }
}