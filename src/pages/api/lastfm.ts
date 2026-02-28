export const prerender = false;

export async function GET() {
    const API_KEY = import.meta.env.LASTFM_API_KEY;
    const USER = "scort_";

    const res = await fetch(
        `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${USER}&api_key=${API_KEY}&format=json&limit=1`
    );
    const data = await res.json();
    console.log("lastfm response:", JSON.stringify(data));

    return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
    });
}