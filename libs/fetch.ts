import fetch, { RequestInfo, RequestInit, Response } from 'node-fetch';
import { ProxyAgent } from 'proxy-agent';

export async function node_fetch(
    url: RequestInfo, init: RequestInit={}): Promise<Response> {
    init.agent = new ProxyAgent();
    if (!init.headers) {
        init.headers = {};
    }
    init.headers["User-Agent"] =
        'Mozilla/5.0 (WIN10 x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    try {
        return await fetch(url, init);
    } catch (e) {
        console.log(e);
        process.exit(1);
    }
}

export default node_fetch;
