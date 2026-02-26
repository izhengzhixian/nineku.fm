import { fetch as node_fetch, ProxyAgent, RequestInit, RequestInfo, Response } from 'undici';
import jschardet from 'jschardet';

export async function fetch(
    url: RequestInfo, init: RequestInit={}): Promise<Response> {
    
    init.credentials = 'omit';
    if (!init.headers) {
        init.headers = {};
    }
    let headers = init.headers as Record<string, string>;
    headers["User-Agent"] =
        'Mozilla/5.0 (WIN10 x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';
    try {
        return await node_fetch(url, init);
    } catch (e) {
        console.log(e);
        process.exit(1);
    }
}

export async function fetch_text(url: string, encoding: string=""): Promise<string> {
    let resp = await fetch(url);
    const arrayBuffer = await resp.arrayBuffer();
    if (resp.status != 200) {
        return "";
    }
    const buffer = Buffer.from(arrayBuffer);
    if (!encoding) {
        const detection = jschardet.detect(buffer);
        encoding = detection.encoding || 'utf-8';
    }
    const decoder = new TextDecoder(encoding);
    return decoder.decode(buffer) || "";
}
