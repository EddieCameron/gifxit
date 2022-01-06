import { GiphyFetch } from '@giphy/js-fetch-api'
import { getGifWithGiphyId } from './gifcontroller'
require("isomorphic-fetch");

const gf = new GiphyFetch('5r0wlCxVXAzvMxeakZoinngVKYwHvvMA')

export async function getNewRandomGif() {
    for (let i = 0; i < 100; i++) {
        const { data: gif } = await gf.random({ type: 'gifs' })
        const existingGif = await getGifWithGiphyId( gif.id.toString())
        if (existingGif == undefined)
            return gif;
    }
    return null;
}

export async function getNewTrendingGif() {
    const { data: gifs } = await gf.trending({ type: 'gifs' })
    for (const gif of gifs) {
        const existingGif = await getGifWithGiphyId( gif.id.toString())
        if (existingGif == undefined)
            return gif;
    }
    return null;
}

