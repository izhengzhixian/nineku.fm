import fetch from './fetch';

export class LyricLine {
    _time: number = 0;
    _data: string = "";

    setTime(tn: string): boolean {
        let time = 0;
        let ta = tn.split(":");
        if (ta.length < 2)
            return false;
        if (ta[1].indexOf(".") > 0) {
            let tb = ta[1].split(".");
            time = parseInt(ta[0]) * 60 * 1000 +
                parseInt(tb[0]) * 1000 + parseInt(tb[1]) * 10;
        } else {
            time = parseInt(ta[0]) * 60 * 1000 + parseInt(ta[1]) * 1000;
        }
        if (time <= 0) {
            return false;
        }
        if (isNaN(time)) {
            return false;
        }
        this._time = time;
        return true;
    }

    setData(data: string): boolean {
        if (!data) {
            return false;
        }
        this._data = data;
        return true;
    }

    getData(): string {
        return this._data;
    }

    getTime() {
        return this._time;
    }
}


export class Lyrics {
    _lines = new Array<LyricLine>();
    _index = -1;

    constructor() {
    }

    async loadURL(url: string) {
        let resp = await fetch(url);
        let body = await resp.text();
        return this.loadData(body);
    }

    loadData(data: string): Array<LyricLine> {
        data = this.modifyData(data);
        this._lines = this.parseData(data);
        return this._lines;
    }

    modifyData(data: string): string {
        return data;
    }

    parseData(data: string): Array<LyricLine> {
        let lyric_lines = new Array<LyricLine>();
        data.split("[").filter(line => !!line).forEach( line => {
            let lyric = new LyricLine();
            let items = line.split("]");
            if (items.length < 2 || !lyric.setTime(items[0])
                || !lyric.setData(items[1]))
                return;
            lyric_lines.push(lyric);
        });
        return lyric_lines;
    }

    getLyricLine() {
        return this._lines;
    }

    getLyricLineIndexWithTime(time=0): number {
        let line = this._lines[this._index+1];
        while (line) {
            // console.log(line.getTime(), time);
            if (line.getTime() >= time) {
                break;
            } else {
                this._index++;
            }
            line = this._lines[this._index+1];
        }
        if (line) {
            return Math.max(this._index, 0);
        }
        return -1;
    }
}
