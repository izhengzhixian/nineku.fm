import * as fs from 'fs';
import * as path from 'path';

import { CategoryLoader } from './category';

const LOADERS_DIR = path.join(__dirname, 'loaders');

export async function loadAllLoaders(): Promise<Array<CategoryLoader>> {
    let loader_paths = fs.readdirSync(LOADERS_DIR).map(
        (name) => {
            if (!name.endsWith(".js")) {
                return "";
            }
            const loader_path = path.join(LOADERS_DIR, name);
            if (fs.statSync(loader_path).isDirectory()) {
                return "";
            }
            return loader_path;
        }
    ).filter((name) => !!name);

    let loaders = new Array<CategoryLoader>();

    for (let loader_path of loader_paths) {
        let loader = await import(loader_path);
        loaders.push(new loader.default());
    }
    return loaders;
}
