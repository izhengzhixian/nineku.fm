import fs from 'fs';
import FfmpegCommand from "fluent-ffmpeg";
import Volume from "pcm-volume";
import Speaker from "speaker";
import { node_fetch as fetch } from './fetch';
import { Readable } from 'stream';

declare type closeCallback = () => void;

export default class SoundPlayer {
    _ffmpeg: FfmpegCommand = null;
    _volume = new Volume();
    _speaker = new Speaker();
    _play = false;
    _volume_rate = 100;
    _callback: () => void;
    _uri = "";

    constructor(volume_rate: number) {
        this._volume_rate = volume_rate;
        this.updateVolume();
    }

    setCloseCallback(callback: closeCallback) {
        this._callback = callback;
    }

    _closeCallback() {
        if (this._callback) {
            let callback = this._callback;
            this._callback = null;
            callback();
        }
    }

    async _getURLStream(url: string) {
        let resp = await fetch(url);
        return new Readable().wrap(resp.body);
    }

    async createStream(uri: string) {
        if (this._isURL(uri)) {
            return await this._getURLStream(uri);
        }
        return fs.createReadStream(uri);
    }

    updateVolume() {
        this._volume.setVolume(this.getVolume() / 100);
    }

    _isURL(uri: string): boolean {
        if (uri.startsWith("http://")
            || uri.startsWith("https://")) {
            return true;
        }
        return false;
    }

    async load(uri: string) {
        let stream = await this.createStream(uri);
        this._ffmpeg = new FfmpegCommand(stream);
        this._ffmpeg.toFormat('s16le').pipe(this._volume);
        this._uri = uri;
        this._speaker.on("close", () => {
            this._closeCallback();
        });
    }

    start(): boolean {
        if (this._play) {
            return false;
        }
        this._play = true;
        this._volume.pipe(this._speaker);
        return true;
    }

    pause() {
        if (!this._play) {
            return false;
        }
        this._play = false;
        this._volume.unpipe();
        return true;
    }

    getVolume(): number {
        return this._volume_rate;
    }

    upVolume() {
        if (this._volume_rate < 125) {
            this._volume_rate++;
            this.updateVolume();
        }
    }

    downVolume() {
        if (this._volume_rate > 0) {
            this._volume_rate--;
            this.updateVolume();
        }
    }

    isPlay() {
        return this._play;
    }

    hasMusic() {
        return !!this._ffmpeg;
    }

    close() {
        if (this._ffmpeg) {
            this._ffmpeg.on('error', () => { });
            this._ffmpeg.kill('SIGTERM');
            this._speaker.end();
            this._ffmpeg = null;
        }
    }
};
