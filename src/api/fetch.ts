export async function fetchJson(url: string) {
    let resp = null;
    try {
        const data = await fetch(url);
        resp = { data: await data.json() };
    } catch (e) {
        resp = { err: e.message };
    }
    return resp;
}
