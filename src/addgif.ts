import { query } from "./server";
import bent from "bent";
import e from "express";
import { SlashResponse } from "./slack";

const gifMagic = '47494638'
const getGif = bent('GET', "buffer", 200, 206, { Range: "bytes=0-16" } );

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
        await query("INSERT INTO gifs(url) VALUES($1)", url);
        return { response_type: "ephemeral", text: "Added " + url };
    }
    catch (e) {
        return { response_type: "ephemeral", text: "Couldn't add GIF. Was the URL unique?" };
    }
}