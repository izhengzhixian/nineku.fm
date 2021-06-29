import fetch from 'node-fetch';
import { RequestInfo, RequestInit,
         Response, HeadersInit } from 'node-fetch';
const ProxyAgent = require('proxy-agent');

export async function node_fetch(
    url: RequestInfo, init: RequestInit={}): Promise<Response> {
    if (process.env.http_proxy && !init.agent) {
        init.agent = new ProxyAgent(process.env.http_proxy);
    }
    if (!init.headers) {
        init.headers = {};
    }
    init.headers["User-Agent"] =
        'Mozilla/5.0 (WIN10 x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36';
    try {
        return await fetch(url, init);
    } catch (e) {
        console.log(e);
        process.exit(1);
    }
}
