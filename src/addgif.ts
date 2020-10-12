import { query } from "./server";
import bent from "bent";
import e from "express";
import { SlashResponse } from "./slack";
import { IGif } from "@giphy/js-types";
import Gif from "./models/gif";

const gifMagic = '47494638'
const getGif = bent('GET', "buffer", 200, 206, { Range: "bytes=0-16" } );

async function getGiphyInfo(url: string) {
    if (!url.includes('giphy'))
        return undefined;

    const match = url.match(  /.+\/(.+)\// );
    if ( match != undefined ) {
        const id = match[1]
        const url = `https://api.giphy.com/v1/gifs/${id}?api_key=${process.env.GIPHY_API_KEY}`
        return await bent('json')(url) as GiphyResult;
    }
}

export async function addGif(url: string): Promise<SlashResponse> {
    try {
        const gifBuffer = await getGif(url) as Buffer;
        const magicNumber = gifBuffer.toString('hex', 0, 4);
        if (magicNumber != gifMagic)
            throw new Error("Not a GIF")
    }
    catch (e) {
        return { response_type: "ephemeral", text: "Not a valid GIF url" };
    }

    try {
        const giphyInfo = await getGiphyInfo(url)
        if (giphyInfo === undefined) {
            await query(null, "INSERT INTO gifs(url) VALUES($1)", url);
        }
        else {
            await query(null, "INSERT INTO gifs(url,giphy_fixed_height,giphy_downsized) VALUES($1,$2,$3)", url, giphyInfo.data.images.fixed_height.url, giphyInfo.data.images.downsized.url );
        }
        return { response_type: "ephemeral", text: "Added " + url };
    }
    catch (e) {
        return { response_type: "ephemeral", text: "Couldn't add GIF. Was the URL unique?" };
    }
}

export async function addGiphyGif(gif: IGif) {
    return (await query<Gif>(null, "INSERT INTO gifs(url,giphy_fixed_height,giphy_downsized, giphy_id) VALUES($1,$2,$3,$4) RETURNING *", gif.url, gif.images.fixed_height, gif.images.downsized, gif.id))[0];
}

export async function removeGif(url: string): Promise<SlashResponse> {
    try {
        await query(null, "DELETE FROM gifs WHERE url=$1", url);
        return { response_type: "ephemeral", text: "Removed " + url };
    }
    catch (e) {
        return { response_type: "ephemeral", text: "Couldn't remove GIF. Was this ever actually a gif?" };
    }
}

interface GiphyResult {
    meta: {
        status: number;
    };
    data: {
        id: string;
        images: {
            fixed_height: {
                url: string;
            };
            downsized: {
                url: string;
            };
        };
    };
}