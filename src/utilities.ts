/**
 * Shuffles array in place. ES6 version
 * @param {Array} a items An array containing the items.
 */
export function shuffle(a: any[]) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export function getEmojiForNumber(num: number) {
    if (num == undefined)
        return " ";
    
    const stringNum = num.toString();
    let emojiString = "";
    for (let index = 0; index < stringNum.length; index++) {
        const digit = stringNum[index];
        switch (digit) {
            case "0":
                emojiString += "0️⃣";
                break;
            case "1":
                emojiString += "1️⃣";
                break;
            case "2":
                emojiString += "2️⃣";
                break;
            case "3":
                emojiString += "3️⃣";
                break;
            case "4":
                emojiString += "4️⃣";
                break;
            case "5":
                emojiString += "5️⃣";
                break;
            case "6":
                emojiString += "6️⃣";
                break;
            case "7":
                emojiString += "7️⃣";
                break;
            case "8":
                emojiString += "8️⃣";
                break;
            case "9":
                emojiString += "9️⃣";
                break;
            
            default:
                emojiString += " ";
                break;
            }
    }
    return emojiString;
}

export const bellGifs = [
    "https://media.giphy.com/media/XF2WX3PiYOH8Q/giphy.gif",
    "https://media.giphy.com/media/ghBHbA9qUIHZFYTqjw/giphy.gif",
    'https://media.giphy.com/media/WREjsSwdm31MwTDW34/giphy.gif'
]

export function getFixedHeightUrl(url: string) {
    if (url.endsWith("giphy.gif")) {
        return url.replace("giphy.gif", "200.gif")
    }

    return url;
}