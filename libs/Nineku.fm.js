var os = require("os");
var fs = require("fs");
var http = require("http");
var path = require("path");
var Ffmpeg = require("fluent-ffmpeg");
var stream = require("stream");
var Volume = require("pcm-volume");
var request = require("request");
var cheerio = require("cheerio");
var Speaker = require("speaker");
var keypress = require("keypress");
var readlineSync = require("readline-sync");


var template = '\033[20;{{code}}m{{data}}\033[0m';
var colorMap = {
    black: 30,
    red: 31,
    green: 32,
    yellow: 33,
    blue: 34,
    white: 37
};

function reCallConsole(color, args) {
    var colorCode = colorMap[color];
    var cstring = args[0];
    var cstringtemp = template.replace(/{{code}}/g, colorCode);
    cstring = cstringtemp.replace(/{{data}}/g, cstring);
    args[0] = cstring;
    console.log.apply(null, args);
}

function reCallConsoleStr(color, args) {
    var colorCode = colorMap[color];
    var cstring = args[0];
    var cstringtemp = template.replace(/{{code}}/g, colorCode);
    cstring = cstringtemp.replace(/{{data}}/g, cstring);
    return cstring;
}

var colorlog = {};

for (var key in colorMap) {
    (function(key) {
        colorlog[key] = {};
        colorlog[key].log = function() {
            return reCallConsole(key, arguments);
        };
        colorlog[key].str = function() {
            return reCallConsoleStr(key, arguments);
        };
    })(key);
}
colorlog["str"] = {};
colorlog["str"].log = function() {
    console.log.apply(null, arguments);
}

function num2str(num) {
    if (num < 10)
        return "0" + num;
    else
        return "" + num;
}

function Timer() {
    this._time = 0;
    // 误差时间调整
    this.error = 0;
    this.start_time = 0;
    this.stop_time = 0;
}
Timer.prototype.start = function() {
    if (this.start_time == 0)
        this.start_time = Date.now();
}
Timer.prototype.stop = function() {
    if (this.start_time == 0)
        return
    this.stop_time = Date.now();
    this._time = this._time + (this.stop_time - this.start_time);
    this.start_time = 0;
}
Timer.prototype.init = function() {
    this._time = 0;
    this.start_time = 0;
    this.stop_time = 0;
}
Timer.prototype.time = function() {
    if (this.start_time == 0)
        return this._time;
    return this._time + (Date.now() - this.start_time);
}
Timer.prototype.add = function(msec) {
    if (msec == undefined)
        this._time += this.error;
    else
        this._time += msec;
}
Timer.prototype.show = function(time) {
    if (time == undefined)
        time = this.time();
    sec = Math.floor(time / 1000);
    minute = Math.floor(sec / 60);
    sec = sec % 60;
    return num2str(minute) + ":" + num2str(sec);
}

function LrcMonitor() {
    this.monitor = [];
    this.status = 0;
    this.index = 1;
    /*
     * status:0 代表没有获得空闲对象,可以getindex,不可以submit
     * status:1 代表有空闲对象,可以getindex,可以submit
     */
}
LrcMonitor.prototype.getindex = function() {
    this.status = 1;
    return this.index;
}
LrcMonitor.prototype.submit = function(submit) {
    if (this.status) {
        this.monitor[this.index] = submit;
        this.status = 0;
        this.index++;
        return
    }
}
LrcMonitor.prototype.getsubmit = function(index) {
    return this.monitor[index];
}

function Ninekufm() {
    var self = this;
    process.title = "9ku.fm";
    this.play = false;
    this.want_play = undefined;
    this.mode = "client";
    this.user_config_dir = path.join(os.homedir(), ".config/nineku.fm");
    this.user_config_path = path.join(this.user_config_dir, "user.config");
    this.fenlei_list = [];
    this.music_list = [];
    this.timer = new Timer();
    if (os.platform() == "win32")
        this.timer.error = 3000;
    else if (os.platform() == "linux")
        this.timer.error = 700;
    else
        this.timer.error = 0;
    this.volume = new Volume();
    this._volume = 100;
    this.null = new stream.PassThrough();
    this.speaker = new stream.PassThrough();
    this.speaker_close = function() {
        if (self.want_play == undefined) {} else if (self.want_play) {
            self.want_play = undefined;
            self.start();
        } else {
            self.want_play = undefined;
            self.run_fenge(self.show_pos[0], self.show_pos[1]);
        }
    };
    this.cur_music = [];
    this._cleartip;
    this.cur_pos = [0, 0, 0];
    this.show_pos = [0, 0, 0];
    this.lrc_index = 0;
    this.geciobj = [];
    this.geci_ok = false;
    this.remote_addr = "http://www.free521.cn/ninekufm.php"
    this.fenlei = "                    ";
    this.fenge = "   ";
    this.music_space = "          ";
    this.lrc_space = "               ";
    this.tip_space = "    ";
    this.console = {
        nullline1: {
            color: "white",
            str: ""
        },
        nullline2: {
            color: "white",
            str: ""
        },
        fenlei: {
            color: "str",
            str: this.fenlei + "分类未加载"
        },
        fenge: {
            color: "str",
            str: this.fenge + "风格未加载"
        },
        splitline1: {
            color: "white",
            str: "----------------------------------------------------------------------------"
        },
        gqname: {
            color: "green",
            str: this.music_space + "歌曲信息未加载"
        },
        gsname: {
            color: "green",
            str: ""
        },
        zjname: {
            color: "green",
            str: ""
        },
        volume: {
            color: "green",
            str: ""
        },
        time: {
            color: "green",
            str: ""
        },
        nullline3: {
            color: "white",
            str: ""
        },
        splitline2: {
            color: "white",
            str: "----------------------------------------------------------------------------"
        },
        nullline4: {
            color: "white",
            str: ""
        },
        lrc1: {
            color: "white",
            str: ""
        },
        lrc2: {
            color: "white",
            str: ""
        },
        lrc3: {
            color: "green",
            str: ""
        },
        lrc4: {
            color: "white",
            str: ""
        },
        lrc5: {
            color: "white",
            str: ""
        },
        nullline4: {
            color: "white",
            str: ""
        },
        nullline5: {
            color: "white",
            str: ""
        },
        tip: {
            color: "white",
            str: ""
        },
        tip1: {
            color: "green",
            str: this.tip_space + "n:下一曲  space:播放(暂停)  <:减小音量  >:增加音量  q:退出 s:喜爱"
        },
        tip2: {
            color: "green",
            str: this.tip_space + "up,down(j,k):选择分类  left,right(h,l):选择风格  d:删除  t:讨厌"
        },
        debug: {
            color: "white",
            str: ""
        },
    };
    this.help = {};
    this.error = function(select, option) {
        if (select == "request") {
            console.log("不能访问" + option["host"] + "，请检查网络");
        }
        process.exit();
    }
}
Ninekufm.prototype.action = function() {
    var self = this;
    var action = process.argv[2];

    if (action == undefined) {
        self.load_user_config();
        return true;
    } else if (action == "config") {
        self.load_user_config();
        var email = readlineSync.question("email(" +
            self.user_config["email"] + "):");
        var username = readlineSync.question("username(" +
            self.user_config["username"] + "):");
        var password = readlineSync
            .question("password:", {
                hideEchoBack: true,
                mask: ''
            });
        var ok = readlineSync.question("Do you want to continue? (y/N)");
        if (ok != "y" && ok != "Y") {
            process.exit();
        }
        self.user_config["email"] = email ? email : self.user_config["email"];
        self.user_config["username"] = username ? username : self.user_config["username"];
        self.user_config["password"] = password;
        console.log("config......");
        fs.writeFileSync(self.user_config_path,
            JSON.stringify(self.user_config, null, 4), "utf-8");
        console.log("OK");
        process.exit();
    } else if (action == "init") {
        self.load_user_config("null");
        var email = readlineSync.question("email(" +
            self.user_config["email"] + "):");
        var username = readlineSync.question("username(" +
            self.user_config["username"] + "):");
        var password = readlineSync
            .question("password:", {
                hideEchoBack: true,
                mask: ''
            });
        var ok = readlineSync.question("Do you want to continue? (y/N)");
        if (ok != "y" && ok != "Y") {
            process.exit();
        }
        self.user_config["email"] = email ? email : self.user_config["email"];
        self.user_config["username"] = username ? username : self.user_config["username"];
        self.user_config["password"] = password;
        console.log("init......");
        fs.writeFileSync(self.user_config_path,
            JSON.stringify(self.user_config, null, 4), "utf-8");
        console.log("OK");
        process.exit();
    } else if (action == "help") {
        self.help["config"] = "config\t\t\t配置本地用户，如果没有会新建，存在会只修改用户信息";
        self.help["init"] = "init\t\t\t初始化一个本地配置文件，如果存在会删除以前的";
        self.help["help"] = "help\t\t\t输出帮助文档";
        self.help["server"] = "server [port] [format]\thttp服务器,输出format格式(默认mp3)的音频,监听port端口(默认9999)";
        self.help["tip"] = "注意：退出有两种方式，q(会保存配置)，ctrl+c(不会保存配置)";
        for (line in self.help) {
            console.log(self.help[line]);
        }
        process.exit();
    } else if (action == "server") {
        self.load_user_config();
        self.timer.error = 10000;
        /*   非常不成熟，服务器与客户端不同步，正在寻找解决办法   */
        var output_type = "mp3";
        var listen_port = "9999";
        self.mode = "server";
        var arg3 = process.argv[3];
        var arg4 = process.argv[4];
        if (arg3) {
            if (Number(arg3)) {
                listen_port = arg3;
            } else {
                output_type = arg3;
            }
            if (arg4) {
                if (Number(arg4)) {
                    listen_port = arg4;
                } else {
                    output_type = arg4;
                }
            }
        }

        self.pass = stream.PassThrough();
        self.server_speaker = stream.PassThrough();
        var server = http.createServer(function(request, response) {
            self.settip("client connection");
            response.writeHead(200, {
                "Content-Type": "audio/mpeg",
                "Connection": "Keep-Alive"
            });
            self.pass.pipe(response);
        });
        server.listen(Number(listen_port));
        self.outmp3_command = new Ffmpeg(self.server_speaker).inputOptions(["-ac 2"]);
        self.outmp3_command.fromFormat("s16le").toFormat(output_type).pipe(self.pass);
        return true;
    } else {
        console.log("错误指令");
        process.exit();
    }
}
Ninekufm.prototype.init = function() {
    var self = this;
    if (!fs.existsSync(self.user_config_dir))
        fs.mkdirSync(self.user_config_dir);
    if (self.action()) {
        var res = request.get("http://www.9ku.com/fm/", function(error, response, body) {
            if (error) {
                self.error("request", error);
            }
            var $ = cheerio.load(body);
            var fenlei = $('.fmMhzBox ul');
            var fenge_head = $("ul.fmNav.clearfix li a");
            for (var i = 0; i < fenge_head.length; i++) {
                var fenlei_obj = {};
                fenlei_obj.name = fenge_head[i].children[0].data;
                fenlei_obj.fenge_list = [];
                for (var j = 0; j < fenlei[i].children.length; j++) {
                    if (fenlei[i].children[j].type == "tag") {
                        var fenge = {};
                        fenge["name"] = fenlei[i].children[j].children[1].children[3].children[0].data;
                        fenge["link"] = "http://www.9ku.com/fm/fenge/" + fenlei[i].children[j].attribs["data-id"] + ".js";
                        fenge["type"] = "http";
                        fenge["data"] = undefined;
                        fenlei_obj.fenge_list.push(fenge);
                    }
                }
                self.fenlei_list.push(fenlei_obj);
            }
            self.run_fenge();
            self.fenlei_list.push(self.user_config["data"]["custom"]);
        });
        console.log("\33[?25l");
        this.keypress();
        self.printconsole();
    }
}
Ninekufm.prototype.settip = function(str, timeout) {
    var self = this;
    if (self._cleartip) {
        clearTimeout(self._cleartip);
    }
    if (timeout == undefined)
        timeout = 3000;
    self._cleartip = undefined;
    self.setconsole("tip", {
        str: str,
        timeout: timeout
    });
}
Ninekufm.prototype.load_user_config = function(error) {
    var self = this;
    try {
        if (error) {
            throw "error";
        }
        var user_config = fs.readFileSync(self.user_config_path, "utf-8");
        self.user_config = JSON.parse(user_config);
        self.settip("用户配置检测完成，有" +
            self.user_config["data"]["custom"].fenge_list[0].data.length + "首喜爱的歌曲，" +
            self.user_config["data"]["custom"].fenge_list[1].data.length + "首讨厌的歌曲");
    } catch (err) {
        self.user_config = {
            "email": "",
            "username": "",
            "password": "",
            "data": {
                "custom": {
                    "name": "自定义",
                    "fenge_list": [{
                            "name": "喜爱",
                            "link": "",
                            "type": "data",
                            "data": []
                        },
                        {
                            "name": "讨厌",
                            "link": "",
                            "type": "data",
                            "data": []
                        }
                    ]
                }
            }
        };
        self.settip("user_config 未加载，将会重新创建一个");
    }
}
Ninekufm.prototype.debug = function(str) {
    this.console["debug"].str += "    " + str;
}

Ninekufm.prototype.keypress = function() {
    var self = this;
    keypress(process.stdin);
    process.stdin.on("keypress", function(ch, key) {
        var fenlei_length = self.fenlei_list.length;
        if (fenlei_length)
            var fenge_length = self.fenlei_list[self.show_pos[0]].fenge_list.length;
        if (key && key.ctrl && key.name == "c") {
            process.stdout.cursorTo(0, 0);
            process.stdout.clearScreenDown();
            console.log("\33[?25h");
            process.exit();
        } else if (key && key.name == "space") {
            if (self.play) {
                self.volume.unpipe();
                self.play = false;
                self.timer.stop();
                self.timer.add();
            } else {
                self.volume.pipe(self.speaker);
                self.play = true;
                self.timer.start();
            }
        } else if (ch == "q") {
            fs.writeFileSync(self.user_config_path,
                JSON.stringify(self.user_config, null, 4), "utf-8");
            process.stdout.cursorTo(0, 0);
            process.stdout.clearScreenDown();
            console.log("\33[?25h");
            process.exit();
        } else if (ch == ".") {
            self.upVolume();
        } else if (ch == ",") {
            self.downVolume();
        } else if (ch == "n") {
            self.volume.unpipe();
            self.want_play = true;
            self.speaker.end();
        } else if (ch == "k" || key && key.name == "up") {
            self.show_pos[0] = (self.show_pos[0] - 1 + fenlei_length) % fenlei_length;
            self.show_pos[1] = 0;
        } else if (ch == "j" || key && key.name == "down") {
            self.show_pos[0] = (self.show_pos[0] + 1) % fenlei_length;
            self.show_pos[1] = 0;
        } else if (ch == "h" || key && key.name == "left") {
            self.show_pos[1] = (self.show_pos[1] - 1 + fenge_length) % fenge_length;
        } else if (ch == "l" || key && key.name == "right") {
            self.show_pos[1] = (self.show_pos[1] + 1) % fenge_length;
        } else if (key && key.name == "return") {
            self.volume.unpipe();
            self.want_play = false;
            self.speaker.end();

        } else if (ch == "s") {
            if (self.check_love(self.cur_music)) {
                self.settip("本歌曲已经添加到喜爱，不能重复添加");
            } else {
                self.user_config["data"]["custom"].fenge_list[0]["data"].push(self.cur_music);
                self.settip("添加到喜爱一首歌曲成功");
            }
        } else if (ch == "t") {
            if (self.check_hate(self.cur_music)) {
                self.settip("本歌曲已经添加到讨厌，不能重复添加");
            } else {
                self.user_config["data"]["custom"].fenge_list[1]["data"].push(self.cur_music);
                self.settip("添加到讨厌一首歌曲成功");
            }
            self.volume.unpipe();
            self.want_play = true;
            self.speaker.end();
        } else if (ch == "d") {
            var ret_index = self.music_list.indexOf(self.cur_music);
            if (ret_index < 0) {
                self.settip("从当前风格删除歌曲失败");
                return;
            } else {
                self.music_list.splice(ret_index, 1);
                self.settip("从当前风格删除歌曲成功");
            }
            self.volume.unpipe();
            self.want_play = true;
            self.speaker.end();
        }
    });
    process.stdin.setRawMode(true);
    process.stdin.resume();
}


Ninekufm.prototype.random = function(range) {
    if (range == undefined) {
        return Math.floor(Math.random() * this.fenlei_list.length);
    } else {
        return Math.floor(Math.random() * range);
    }
}
Ninekufm.prototype.run_fenge = function(fenlei_index, fenge_index) {
    var self = this;
    if (fenlei_index == undefined)
        fenlei_index = 0;

    if (fenge_index == undefined)
        fenge_index = self.random(self.fenlei_list[fenlei_index].fenge_list.length);
    var data_type = this.fenlei_list[fenlei_index].fenge_list[fenge_index]["type"];
    if (data_type == "http") {
        request.get(this.fenlei_list[fenlei_index].fenge_list[fenge_index]["link"],
            function(error, response, body) {
                if (error) {
                    self.error("request", error);
                }
                self.music_list = JSON.parse(body.slice(24, -17));
                self.cur_pos[0] = fenlei_index;
                self.cur_pos[1] = fenge_index;
                self.start();
            });
    } else if (data_type == "data") {
        self.music_list = self.fenlei_list[fenlei_index].fenge_list[fenge_index]["data"];
        self.cur_pos[0] = fenlei_index;
        self.cur_pos[1] = fenge_index;
        self.start();
    }
}
Ninekufm.prototype.get_lrc = function() {
    var self = this;
    self.lrc_index = 0;

    function jtime(tn) {
        var time = 0;
        var ta = tn.split(":");
        if (ta.length < 2)
            return time;
        if (ta[1].indexOf(".") > 0) {
            var tb = ta[1].split(".");
            time = ta[0] * 60 * 1000 + tb[0] * 1000 + tb[1] * 10;
        } else {
            time = ta[0] * 60 * 1000 + ta[1] * 1000;
        }
        return time;
    }

    if (this.cur_music != undefined) {
        var lrc_script = request.get(this.cur_music["lrc"], function(error, response, body) {
            if (error) {
                self.geci = "";
                self.geciobj = [];
                self.error("request", error);
                return
            }
            var song_lrc = body.split("$song_Lrc")[1];
            if (song_lrc == undefined || song_lrc.indexOf("</br>") >= 0) {
                self.geci = "";
                self.geciobj = [];
                return;
            }
            eval("self.geci = " + song_lrc.substring(song_lrc.indexOf("=") + 1));
            self.geciobj = [];
            var left_split = self.geci.split("[");
            var lrcmonitor = new LrcMonitor();
            for (var i = 0; i < left_split.length; i++) {
                var geciobj = {};
                var left = left_split[i];
                if (left) {
                    var time_geci = left.split("]");
                    if (time_geci.length < 2)
                        continue;
                    geciobj.time = jtime(time_geci[0]);
                    if (!geciobj.time && geciobj.time != 0)
                        continue;
                    geciobj.geci = time_geci[1];
                    if (geciobj.geci == "") {
                        geciobj.index = lrcmonitor.getindex();
                    } else {
                        lrcmonitor.submit(geciobj);
                    }
                    self.geciobj.push(geciobj);
                }
            }
            self.geciobj.sort(function(x, y) {
                if (x.time > y.time) return 1;
                else if (x.time < y.time) return -1;
                else return 0;
            });
            var pregeciobj;
            for (var i = self.geciobj.length - 1; i >= 0; i--) {
                if (pregeciobj = lrcmonitor.getsubmit(self.geciobj[i].index)) {
                    self.geciobj[i].geci = pregeciobj.geci;
                }
            }
            self.lrc_index = 1;
            self.geci_ok = true;
        });
    }
};
Ninekufm.prototype.check_love = function(music) {
    var love = this.user_config["data"]["custom"].fenge_list[0]["data"];
    for (var i = 0; i < love.length; i++) {
        if (love[i]["gqid"] == music["gqid"])
            return true;
    }
    return false;
}
Ninekufm.prototype.check_hate = function(music) {
    var hate = this.user_config["data"]["custom"].fenge_list[1]["data"];
    for (var i = 0; i < hate.length; i++) {
        if (hate[i]["gqid"] == music["gqid"])
            return true;
    }
    return false;
}
Ninekufm.prototype.new_music_init = function() {
    var self = this;
    self.timer.init();
    self.geci_ok = false;
    self.setconsole("lrc", "clear");
    self.volume.end();
    self.volume = new Volume();
    if (self.mode == "server") {
        self.speaker = stream.PassThrough();
        self.speaker.pipe(self.server_speaker, {
            end: false
        });
        self.speaker.end = function() {
            this.emit("close");
        };
    } else
        self.speaker = new Speaker();
    self.speaker.on("close", self.speaker_close);
}
Ninekufm.prototype.start = function() {
    var self = this;
    if (!self.music_list.length) {
        self.setconsole("tip", {
            str: "本风格内歌曲个数为0，将随机热门分类中一个风格",
            timeout: 3000
        });
        setTimeout(function() {
            self.run_fenge();
        }, 50);
        return;
    }
    var random_index = self.random(self.music_list.length)
    while (self.check_hate(self.music_list[random_index]) &&
        self.user_config["data"]["custom"].fenge_list[1]["data"] != self.music_list) {
        var ret_index = self.music_list.indexOf(self.cur_music);
        self.music_list.splice(ret_index, 1);
        if (!self.music_list.length) {
            self.setconsole("tip", {
                str: "本风格内歌曲个数为0，将随机热门分类中一个风格",
                timeout: 3000
            });
            setTimeout(function() {
                self.run_fenge();
            }, 50);
            return;
        }
        random_index = self.random(self.music_list.length);
    }
    self.new_music_init();
    if (!self.music_list[random_index]["lrc"]) {
        var lrc_group_id = Math.floor(self.music_list[random_index]["gqid"] / 10000) + 1;
        self.music_list[random_index]["lrc"] = "http://www.9ku.com/html/lrc/" +
            lrc_group_id + "/" + self.music_list[random_index]["gqid"] + ".js";
    }
    self.cur_music = self.music_list[random_index];
    self.setconsole("music");
    var res = request.get(self.cur_music["mp3"]);
    self.cur_pos[2] = random_index;
    self.command = new Ffmpeg(res);
    self.command.toFormat("s16le").pipe(self.volume).pipe(self.speaker);
    self.timer.start();
    self.play = true;
    self.get_lrc();
    //console.log(self.cur_music);
}
Ninekufm.prototype.upVolume = function() {
    var self = this;
    self._volume++;
    // why 126? because my birthday 12.6
    var max_volume = 126;
    if (self._volume > max_volume)
        self._volume = max_volume;
    self.volume.setVolume(self._volume / 100);
}
Ninekufm.prototype.downVolume = function() {
    var self = this;
    self._volume--;
    if (self._volume < 0)
        self._volume = 0;
    self.volume.setVolume(self._volume / 100);
}
Ninekufm.prototype.setconsole = function(select, option) {
    var self = this;

    function fenlei_color(fenlei_index) {
        if (fenlei_index == self.show_pos[0])
            return "blue";
        else
            return "green";
    }

    function fenge_color(fenge_index) {
        if (fenge_index == self.show_pos[1]) {
            if (self.show_pos[0] == self.cur_pos[0] &&
                fenge_index == self.cur_pos[1])
                return "yellow";
            else
                return "blue";
        } else {
            if (self.show_pos[0] == self.cur_pos[0] &&
                fenge_index == self.cur_pos[1])
                return "red";
            else
                return "green";
        }
    }
    if (select == "lrc") {

        if (!option) {
            if (!self.geci_ok) {
                return;
            }
            if (self.lrc_index >= self.geciobj.length) {
                self.geci_ok = false;
                return;
            } else if (self.timer.time() < self.geciobj[self.lrc_index].time) {} else {
                self.console["lrc1"].str = self.lrc_space +
                    (self.geciobj[self.lrc_index - 2] ? self.geciobj[self.lrc_index - 2].geci : "");
                self.console["lrc2"].str = self.lrc_space +
                    (self.geciobj[self.lrc_index - 1] ? self.geciobj[self.lrc_index - 1].geci : "");
                self.console["lrc3"].str = self.lrc_space +
                    (self.geciobj[self.lrc_index + 0] ? self.geciobj[self.lrc_index + 0].geci : "");
                self.console["lrc4"].str = self.lrc_space +
                    (self.geciobj[self.lrc_index + 1] ? self.geciobj[self.lrc_index + 1].geci : "");
                self.console["lrc5"].str = self.lrc_space +
                    (self.geciobj[self.lrc_index + 2] ? self.geciobj[self.lrc_index + 2].geci : "");
                self.lrc_index++;
            }
        } else if (option == "clear") {
            self.console["lrc1"].str = "";
            self.console["lrc2"].str = "";
            self.console["lrc3"].str = "";
            self.console["lrc4"].str = "";
            self.console["lrc5"].str = "";
        }

        return;

    } else if (select == "time") {
        self.console["time"].str = self.music_space + "时  间：" + self.timer.show() + "/" +
            self.timer.show(Number(self.cur_music["mp3time"]) * 1000);
        if ((self.timer.time() - self.cur_music["mp3time"] * 1000) > -500 && self.want_play == undefined)
            self.start();
    } else if (select == "volume") {
        self.console["volume"].str = self.music_space + "音  量：" + self._volume + "%";
    } else if (select == "tip") {
        if (option) {
            self.console["tip"].str = self.tip_space + option["str"];
            setTimeout(function() {
                self.setconsole("tip");
            }, option["timeout"]);
        } else {
            self.console["tip"].str = "";
        }
    } else if (select == "music") {
        self.console["gqname"].str = self.music_space + "歌曲名：" + self.cur_music["gqname"];
        self.console["gsname"].str = self.music_space + "歌手名：" + self.cur_music["gsname"];
        self.console["zjname"].str = self.music_space + "专辑名：" + self.cur_music["zjname"];
    } else if (select == "fenge" && !option) {
        if (!self.fenlei_list.length)
            return;
        var fenlei_console = self.fenlei;
        for (var i = 0; i < self.fenlei_list.length; i++) {
            fenlei_console = fenlei_console + colorlog[fenlei_color(i)]
                .str(self.fenlei_list[i].name) + "  ";
        }
        var fenge_console = self.fenge;
        for (var i = 0; i < self.fenlei_list[self.show_pos[0]].fenge_list.length; i++) {
            fenge_console = fenge_console + colorlog[fenge_color(i)]
                .str(self.fenlei_list[self.show_pos[0]].fenge_list[i].name) + "  ";
        }
        self.console["fenlei"].str = fenlei_console;
        self.console["fenge"].str = fenge_console;;
    }
}
Ninekufm.prototype.printconsole = function() {
    var self = this;

    function print_interface() {
        process.stdout.cursorTo(0, 0);
        process.stdout.clearScreenDown();
        self.setconsole("time");
        self.setconsole("fenge");
        self.setconsole("volume");
        self.setconsole("lrc");
        for (line in self.console) {
            colorlog[self.console[line].color].log(self.console[line].str);
        }
    }
    self.print_interval = setInterval(print_interface, 400);
}
module.exports = Ninekufm;
