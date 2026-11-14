const UID = "66056020786425856";
const SOCKET_URL = "wss://api.lanyard.rest/socket";
const REST_URL = `https://api.lanyard.rest/v1/users/${UID}`;

const FALLBACK_POLL_MS = 30000;
const INIT_TIMEOUT_MS = 5000;
const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

export interface LanyardSpotify
{
    track_id: string | null;
    song: string;
    artist: string;
    album: string;
    album_art_url: string | null;
    timestamps: { start: number; end: number };
}

export interface LanyardActivity
{
    type: number;
    name: string;
    timestamps?: { start?: number; end?: number };
}

export interface LanyardData
{
    discord_user: { id: string; avatar: string | null; username: string; global_name: string | null };
    discord_status: "online" | "idle" | "dnd" | "offline";
    activities: LanyardActivity[];
    listening_to_spotify: boolean;
    spotify: LanyardSpotify | null;
}

type Listener = (data: LanyardData) => void;

const listeners = new Set<Listener>();
let latest: LanyardData | null = null;

let socket: WebSocket | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let backoff = MIN_BACKOFF_MS;
let started = false;

function publish(data: LanyardData)
{
    latest = data;
    listeners.forEach(listener =>
    {
        try { listener(data); }
        catch (error) { console.error("Lanyard listener failed:", error); }
    });
}

async function fetchRest()
{
    try
    {
        const response = await fetch(REST_URL);
        if (!response.ok)
        {
            console.error("Lanyard API error:", response.status, response.statusText);
            return;
        }

        const json = await response.json();
        if (json.success)
            publish(json.data);
    }
    catch (error)
    {
        console.error("Lanyard fetch failed:", error);
    }
}

function startPolling()
{
    if (pollTimer)
        return;

    fetchRest();
    pollTimer = setInterval(fetchRest, FALLBACK_POLL_MS);
}

function stopPolling()
{
    if (pollTimer)
    {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

function scheduleReconnect()
{
    if (reconnectTimer)
        return;

    reconnectTimer = setTimeout(() =>
    {
        reconnectTimer = null;
        connect();
    }, backoff);

    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
}

function connect()
{
    if (socket) // already connecting or open
        return;

    if (reconnectTimer)
    {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    const ws = new WebSocket(SOCKET_URL);
    socket = ws;

    ws.addEventListener("message", (event) =>
    {
        let message: any;
        try { message = JSON.parse(event.data); }
        catch { return; }

        switch (message.op)
        {
            case 1: // subscribe and start heartbeating
                ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: UID } }));

                if (heartbeatTimer)
                    clearInterval(heartbeatTimer);
                heartbeatTimer = setInterval(() =>
                {
                    if (ws.readyState === WebSocket.OPEN)
                        ws.send(JSON.stringify({ op: 3 }));
                }, message.d.heartbeat_interval);
                break;

            case 0: // Event
                if (message.t === "INIT_STATE" || message.t === "PRESENCE_UPDATE")
                {
                    backoff = MIN_BACKOFF_MS;
                    stopPolling();
                    publish(message.d);
                }
                break;
        }
    });

    // error is always followed by close
    ws.addEventListener("close", () =>
    {
        if (heartbeatTimer)
        {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }

        if (socket === ws)
            socket = null;

        startPolling();
        scheduleReconnect();
    });
}

function start()
{
    if (started)
        return;
    started = true;

    connect();

    setTimeout(() =>
    {
        if (!latest)
            fetchRest();
    }, INIT_TIMEOUT_MS);

    // background tabs get their timers throttled and the socket can drop
    document.addEventListener("visibilitychange", () =>
    {
        if (document.visibilityState === "visible" && !socket)
        {
            backoff = MIN_BACKOFF_MS;
            connect();
        }
    });
}

export function subscribeLanyard(listener: Listener): () => void
{
    listeners.add(listener);
    start();

    if (latest)
        listener(latest);

    return () => listeners.delete(listener);
}

export function refreshLanyard()
{
    if (socket?.readyState !== WebSocket.OPEN)
        fetchRest();
}
