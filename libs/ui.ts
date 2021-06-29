import { LyricLine } from './lyrics';
import { Terminal, KeyPressEvent, Color,
         keypressCallback, TerminalEvent } from './terminal';

export { Key } from './terminal';

export enum LineName {
    NULL_LINE1,
    NULL_LINE2,
    CATEGORY,
    STYLE,
    SPLIT_LINE1,
    MUSIC_NAME,
    SONG_NAME,
    ALBUM_NAME,
    VOLUME,
    TIME,
    NULL_LINE3,
    SPLIT_LINE2,
    NULL_LINE4,
    LRC1,
    LRC2,
    LRC3,
    LRC4,
    LRC5,
    NULL_LINE5,
    NULL_LINE6,
    TIP,
    TIP1,
    TIP2,
    DEBUG,
}

enum Position {
    NONE,
    LEFT,
    CENTER,
    RIGHT,
    LEFT_GOLDEN_RATIO,
    RIGHT_GOLDEN_RATIO,
}

enum Group {
    NONE,
    MUSIC_INFO,
}

class UILine {
    public name: LineName;
    public color: Color;
    public data: string;
    public position: Position;
    public group: Group;
    constructor(name: LineName, {
        color = Color.WHITE,
        data = "",
        position = Position.NONE,
        group = Group.NONE,
    }: {
        color?: Color,
        data?: string,
        position?: Position,
        group?: Group,

    } = {}) {
        this.name = name;
        this.color = color;
        this.data = data;
        this.position = position;
        this.group = group;
    }

    getPositionRatio() {
        switch (this.position) {
            case Position.CENTER:
                return 0.5;
            case Position.LEFT_GOLDEN_RATIO:
                return 1-0.618;
            case Position.RIGHT_GOLDEN_RATIO:
                return 0.618;
            case Position.LEFT:
                return 0;
            case Position.RIGHT:
                return 0;
            default:
                return -1;
        }
    }
}


export class UI {
    _lines = new Array<UILine>();
    _line_map = new Map<LineName, UILine>();
    _line_group = new Map<Group, Array<UILine>>();
    _line_indent = new Map<LineName, string>();
    _line_timeout = new Map<LineName, NodeJS.Timeout>();
    _lrcNames = new Array<LineName>();
    _infoNames = new Array<LineName>();
    _terminal = new Terminal();
    _min_width = 80;
    _min_height = 24;
    _width = this._min_width;
    _height = this._min_height;
    _run = false;
    _debug = true;
    _debug_msg = "";
    _show = true;


    constructor() {
        this.beforeInit();
        this.initLineIndent();
        this.initLines();
        this.afterInit();
        this._terminal.hiddenCursor();
    }

    setShow(show=true) {
        this._show = show;
    }

    setKeyPressCallback(callback: keypressCallback) {
        if (this._run) {
            throw "UI is running, not set keypressCallback!!!";
        }
        this._terminal.addKeyPressHook(KeyPressEvent.KEYPRESS, callback);
    }

    run(refresh_callback: () => void, interval=100) {
        if (this._run) {
            return;
        }
        this._run = true;
        this.resize(this._terminal.getWidth(),
            this._terminal.getHeight());
        this._terminal.addTerminalHook(
            TerminalEvent.RESIZE,
            (width, height) => this.resize(width, height));
        this._terminal.run();
        setInterval(() => {
            refresh_callback();
            this.show();
        }, interval);
    }

    resize(width: number, height: number) {
        if (this._width == width && this._height == height) {
            return;
        }
        this._width = Math.max(this._min_width, width);
        this._height = Math.max(this._min_height, height);
    }

    beforeInit() {
        for (let name = LineName.LRC1;
            name <= LineName.LRC5; name++) {
            this._lrcNames.push(name);
        }
        for (let name = LineName.MUSIC_NAME;
            name <= LineName.TIME; name++) {
            this._infoNames.push(name);
        }
    }

    initLineIndent() {
        let info_space = " ".repeat(25);
        this._line_indent.set(LineName.CATEGORY, " ".repeat(20));
        this._line_indent.set(LineName.STYLE, " ".repeat(3));
        this._line_indent.set(LineName.MUSIC_NAME,
                              info_space + "歌曲名: ");
        this._line_indent.set(LineName.SONG_NAME,
                              info_space + "歌手名: ");
        this._line_indent.set(LineName.ALBUM_NAME,
                              info_space + "专辑名: ");
        this._line_indent.set(LineName.VOLUME,
                              info_space + "音  量: ");
        this._line_indent.set(LineName.TIME,
                              info_space + "时  间: ");
        this._lrcNames.forEach(name => {
            this._line_indent.set(name, " ".repeat(20));
        });
        this._line_indent.set(LineName.TIP, " ".repeat(4));
        this._line_indent.set(LineName.TIP1, " ".repeat(4));
        this._line_indent.set(LineName.TIP2, " ".repeat(4));
        this._line_indent.set(LineName.DEBUG, " ".repeat(10));
    }

    initLines() {
        let split_line = "-".repeat(80);
        this.push(LineName.NULL_LINE1);
        this.push(LineName.NULL_LINE2);
        this.push(LineName.CATEGORY, {
            data: "分类未加载",
            position: Position.CENTER,
        });
        this.push(LineName.STYLE, {
            data: "风格未加载",
            position: Position.CENTER,
        });
        this.push(LineName.SPLIT_LINE1, {
            data: split_line
        });
        this.push(LineName.MUSIC_NAME, {
            data: "歌曲信息未加载",
        });
        this.push(LineName.SONG_NAME);
        this.push(LineName.ALBUM_NAME);
        this.push(LineName.VOLUME);
        this.push(LineName.TIME);
        this.push(LineName.NULL_LINE3);
        this.push(LineName.SPLIT_LINE2, {
            data: split_line
        });
        this.push(LineName.NULL_LINE4);
        this.push(LineName.LRC1);
        this.push(LineName.LRC2);
        this.push(LineName.LRC3, {
            color: Color.GREEN,
        });
        this.push(LineName.LRC4);
        this.push(LineName.LRC5);
        this.push(LineName.NULL_LINE5);
        this.push(LineName.NULL_LINE6);
        this.push(LineName.TIP);
        this.push(LineName.TIP1, {
            color: Color.GREEN,
            data: "n:下一曲  space:播放(暂停)  <:减小音量  >:增加音量  q:退出 s:喜爱",
            position: Position.CENTER,
        });
        this.push(LineName.TIP2, {
            color: Color.GREEN,
            data: "up,down(j,k):选择分类  left,right(h,l):选择风格  d:删除  t:讨厌",
            position: Position.CENTER,
        });
        this.push(LineName.DEBUG);
    }

    afterInit() {
        this._lrcNames.forEach(name => {
            let line = this.getLine(name);
            line.position = Position.LEFT_GOLDEN_RATIO;
        });
        this._infoNames.forEach(name => {
            let line = this.getLine(name);
            line.color = Color.GREEN;
            line.group = Group.MUSIC_INFO;
            line.position = Position.LEFT_GOLDEN_RATIO;
        });
        this._line_map.forEach(line => {
            if (line.group == Group.NONE) {
                return;
            }
            if (!this._line_group.has(line.group)) {
                this._line_group.set(line.group, new Array<UILine>());
            }
            this._line_group.get(line.group).push(line);
        });
    }

    push(name: LineName, {
        color = Color.WHITE,
        data = "",
        position = Position.NONE,
        group = Group.NONE,
    }: {
        color?: Color,
        data?: string,
        position?: Position,
        group?: Group,
    } = {}) {
        let line = new UILine(name, {
            color: color,
            position: position,
            group: group,
        });
        if (data) {
            this._render(line, data);
        }
        this.pushLine(line);
    }

    pushLine(line: UILine) {
        this._lines.push(line);
        this._line_map.set(line.name, line);
    }

    getLine(name: LineName): UILine {
        return this._line_map.get(name);
    }

    error(msg = "") {
        this.close();
        if (msg) {
            console.log("Error: ", msg);
        }
        process.exit(1);
    }

    clearLRC() {
        this._lrcNames.forEach(name => {
            this.setLine(name);
        });
    }

    setLRC(lines: Array<LyricLine>, start: number) {
        this._lrcNames.forEach((name, index) => {
            let line = lines[start + index];
            let data = (line && line.getData()) || "";
            this.setLine(name, data);
        });
    }

    setArrayLine(name: LineName,
        items: Array<string>,
        playIndex = -1,
        curPos = -1) {
        if (name != LineName.CATEGORY
            && name != LineName.STYLE) {
            throw "setArrayLine error";
        }
        let line = this.getLine(name);
        let data = items.map((item, index) => {
            let color = line.color;
            if (index == curPos) {
                color = Color.RED;
            } else if (index == playIndex) {
                color = Color.YELLOW;
            }
            return this._terminal.colorData(color, item);
        }).join("  ");
        this._render(line, data);
    }

    beforeShow() {
        if (this._debug && this._debug_msg) {
            this.setLineWithTimeout(LineName.DEBUG, this._debug_msg);
            this.debug("");
        }
        this._line_group.forEach((lines) => {
            let min_indent = Math.min.apply(Math,
                lines.map(line => line.data.search(/\S/))
            );
            lines.forEach(line => {
                line.data = " ".repeat(min_indent) + line.data.trimLeft();
            });
        });
    }

    show() {
        if (!this._show) {
            return;
        }
        this.beforeShow();
        let windent = Math.floor((this._width - this._min_width) / 2);
        let windent_space = " ".repeat(windent);
        let hindent = Math.floor((this._height - this._min_height) / 3);
        this._terminal.clearConsole();
        for (let i = 0; i < hindent; i++) {
            this._terminal.log("");
        }
        this._lines.forEach(line => {
            this._terminal.log(windent_space + line.data);
        });
    }

    _render(line: UILine, data = ""): UILine {
        line.data = (this._line_indent.get(line.name) || "");
        if (data) {
            line.data += this._terminal.colorData(line.color, data);
        }
        let ratio = line.getPositionRatio();
        if (ratio >= 0) {
            let data = line.data.trim();
            let length = this._terminal.colorDataLength(data);
            let indent = Math.floor(
                Math.max(0, this._min_width - length) * ratio);
            line.data = " ".repeat(indent) + data;
        }
        return line;
    }

    debug(msg = "") {
        if (this._debug) {
            if (msg) {
                this._debug_msg += "DEBUG: " + msg + ";  ";
            } else {
                this._debug_msg = "";
            }
        }
    }


    setLine(name: LineName, data = "") {
        this._render(this.getLine(name), data)
    }

    setLineWithTimeout(name: LineName, data="", timeout=3000) {
        this.setLine(name, data);
        if (this._line_timeout.has(name)) {
            clearTimeout(this._line_timeout.get(name));
        }
        this._line_timeout.set(name,
            setTimeout(() => {
                this._line_timeout.delete(name);
                this.setLine(name);
            }, timeout)
        );
    }

    close(clear=true) {
        if (clear) {
            this._terminal.clearConsole();
        }
        this._terminal.displayCursor();
    }
};
