ffmpeg -i "https://skyfire.vimeocdn.com/1687518134-0x39c0894c03673a5b294389315c79d13f6c64b234/dd1110b2-365c-4cea-b02d-c77260e0c86e/sep/video/0544c278,59c1f8b8,9131152f/master.m3u8" -c copy -bsf:a aac_adtstoasc "output.mp4"