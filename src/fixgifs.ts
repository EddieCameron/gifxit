import * as DB from './server';
import Gif from './models/gif';
import bent from "bent";

async function fixgifs() {
    const gifs = await DB.query<Gif>(null, "SELECT * FROM gifs") as Gif[]

    const giphyIds: [Gif, string][] = []
    const regex = /.+\/(.+)\//
    for (const gif of gifs) {
        if (gif.url.includes('giphy')) {
            const match = gif.url.match(regex);
            console.log( match )
            if ( match != undefined ) {
                const id = match[1]
                giphyIds.push( [gif, id] );
            }
        }
    }

    console.log(giphyIds.map(g => g[1]));
    const url = `https://api.giphy.com/v1/gifs?api_key=${process.env.GIPHY_API_KEY}&ids=${giphyIds.map(g => g[1]).join(',')}`
    const giphyResult = await bent('json')(url) as GiphyResult;
    if (giphyResult.meta.status == 200) {
        await DB.transactionCallback(async client => {
            for (const giphyGif of giphyResult.data) {
                const matchingGif = giphyIds.find(g => g[1] == giphyGif.id)[0];
                client.query("UPDATE gifs SET giphy_fixed_height=$1, giphy_downsized=$2 WHERE id=$3", [giphyGif.images.fixed_height, giphyGif.images.downsized, matchingGif.id ]);
            }
        });
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
    }[];
}

fixgifs()
    .catch(e => console.error(e));