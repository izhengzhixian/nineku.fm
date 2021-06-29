import * as os from 'os';

export default class Timer {
    _play_time = 0;
    _start_time = 0;
    _stop_time = 0;
    _error = 0;
    _second_ratio = 1.04;

    constructor() {
        if (os.platform() == "win32")
            this._error = 3000;
        else if (os.platform() == "linux")
            this._error = 100;
        else
            this._error = 0;
    }

    public reset() {
        this._play_time = 0;
        this._start_time = 0;
        this._stop_time = 0;
    }

    public start() {
        if (!this._start_time)
            this._start_time = Date.now();
    }

    public stop() {
        if (!this._start_time)
            return;
        this._stop_time = Date.now();
        this._play_time += (this._stop_time - this._start_time)
            * this._second_ratio;
        this._start_time = 0;
    }

    public getPlayTime() {
        if (this._start_time) {
            return this._play_time +
                (Date.now() - this._start_time) * this._second_ratio;
        }
        return this._play_time;
    }

    public show(time=0) {
        if (!time)
            time = this.getPlayTime();
        let sec = Math.floor(time / 1000);
        const minute = Math.floor(sec / 60);
        sec = sec % 60;
        return this.num2str(minute) + ":" + this.num2str(sec);
    }

    num2str(num: number): string {
        if (num < 10) {
            return "0" + String(num);
        }
        return String(num);
    }
}
