import { Lyrics } from './lyrics';

export abstract class Music {
    abstract getName(): string;
    abstract getSong(): string;
    abstract getAlbum(): string;
    abstract getLyrics(): Promise<Lyrics>;
    abstract getURI(): string;
    abstract getTime(): number;
    abstract getSize(): number;

    abstract serialization(): Object;
    abstract componentName(): string;

    toJSON() {
        return {
            name: this.componentName(),
            data: this.serialization(),
        };
    }

    static fromJSON(data: Object): Music {
        return loadMusic(data["name"], data["data"]);
    }
};


export abstract class MusicStyle {
    _allow_remove = true;

    abstract getName(): string;
    abstract getMusics(): Promise<Array<Music>>;
    allowRemove(): boolean {
        return this._allow_remove;
    }
};


export abstract class Category {
    abstract getName(): string;
    abstract getStyles(): Array<MusicStyle>;
};

export class SimpleMusicStyle extends MusicStyle {
    _name = "";
    _musics = new Array<Music>();

    constructor(name: string, musics: Array<Music>=null, allow_remove=true) {
        super();
        this._name = name;
        if (musics) {
            this._musics = musics;
        }
        this._allow_remove = allow_remove;
    }

    getName(): string {
        return this._name;
    }

    async getMusics(): Promise<Array<Music>> {
        return this._musics;
    }

    toJSON(): Object {
        return {
            name: this._name,
            musics: this._musics,
        };
    }

    static fromJSON(data: Object): MusicStyle {
        return new SimpleMusicStyle(
            data["name"],
            data["musics"].map(music => Music.fromJSON(music)
            ), false);
    }
}

export class SimpleCategory extends Category {
    _name = "";
    _styles = new Array<MusicStyle>();

    constructor(name: string, styles: Array<MusicStyle>=null, allow_random=true) {
        super();
        this._name = name;
        if (styles) {
            this._styles = styles;
        }
    }

    getName(): string {
        return this._name;
    }

    getStyles(): Array<MusicStyle> {
        return this._styles;
    }

    toJSON(): Object {
        return {
            name: this._name,
            styles: this._styles,
        };
    }

    static fromJSON(data: Object): Category {
        return new SimpleCategory(
            data["name"], data["styles"].map(style =>
                SimpleMusicStyle.fromJSON(style)
            ), false);
    }
}

export interface CategoryLoader {
    getCategories(): Promise<Array<Category>>;
}

declare type MusicLoader = (data: Object) => Music;
let musicLoaderMap = new Map<string, MusicLoader>();

export function registerMusicLoader(name: string, loader: MusicLoader) {
    musicLoaderMap.set(name, loader);
}

export function getMusicLoader(name: string): MusicLoader {
    return musicLoaderMap.get(name);
}

export function loadMusic(name: string, data: Object): Music {
    return getMusicLoader(name)(data);
}
