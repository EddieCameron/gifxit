export default interface Gif {
    id: number;

    url: string;

    giphy_fixed_height: GifInfo;

    giphy_downsized: GifInfo;
}

export interface GifInfo {
    url: string;
    mp4: string;
}