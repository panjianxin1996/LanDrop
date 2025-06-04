/**
 * 文件大小单位换算（默认从 Bytes 转换为目标单位）
 * @param bytes 文件大小（字节数）
 * @param targetUnit 目标单位（'Bytes' | 'KB' | 'MB' | 'GB' | 'TB'），默认为 'MB'
 * @returns 转换后的数值（保留两位小数）
 */
type UnitCalc = {
    Unit: string,
    Num: number
}
export function unitCalc(
    bytes: number,
    targetUnit: 'Bytes' | 'KB' | 'MB' | 'GB' | 'TB' = 'MB'
): UnitCalc {
    const units = { Bytes: 0, KB: 1, MB: 2, GB: 3, TB: 4 };
    const data = (bytes / Math.pow(1024, units[targetUnit])).toFixed(2)
    return {
        Unit: data + targetUnit,
        Num: parseFloat(data)
    };
}

/**
 * 自动计算最适合的字节单位
 * 遍历预定义单位（KB、MB、GB、TB），找到转换后数值小于1024的最大单位。
 * 如果找不到合适单位，则返回原始的字节值。
 * 
 * @param bytes - 输入字节数
 * @returns UnitCalc 对象，包含:
 *          - `Unit`: 带单位的字符串值（如 "1.5MB"）
 *          - `Num`: 单位转换前的数值
 */
export function autoUnitCalc(bytes: number): UnitCalc {
    const units: ('KB' | 'MB' | 'GB' | 'TB')[] = ['KB', 'MB', 'GB', 'TB'];
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        const result = unitCalc(bytes, unit);
        if (result.Num < 1024) {
            return result;
        }
    }
    return {
        Unit: bytes + 'Bytes',
        Num: bytes
    };
}

/**
 * 获取文件扩展名
 * 
 * 该函数通过文件名获取文件的类型（扩展名），主要用于文件名字符串的处理
 * 它将文件名按点号分割成数组，取最后一个元素作为文件类型，并转为小写
 * 
 * @param fileName 文件名，包含文件扩展名
 * @returns 文件类型的小写字符串，如果文件名不含扩展名或为空，则返回空字符串
 */
export function getFileExtension(fileName: string) {
    return fileName.split('.').pop()?.toLowerCase();
}

/**
 * 根据文件名获取文件类型
 * 
 * 通过检查文件扩展名来确定文件的类型如果文件没有扩展名或者扩展名不匹配已知类型，
 * 则将其归类为'default'类型这个函数支持多种文件类型的识别，包括文档、图片、视频、音乐、压缩文件和代码文件
 * 
 * @param fileName 文件名，用于提取文件扩展名
 * @returns 文件类型字符串，'pdf', 'txt', 'word', 'excel', 'picture', 'video', 'music', 'zip', 'code'或'default'
 */
export function getFileType(fileName: string) :string {
    const extensionName = getFileExtension(fileName)
    if (!extensionName) return 'default'
    else if (extensionName === 'pdf') return 'pdf'
    else if (extensionName === 'txt') return 'txt'
    else if (['doc', 'docx'].includes(extensionName)) return "word"
    else if (['xls', 'xlsx'].includes(extensionName)) return "excel"
    else if (['ppt', 'pptx'].includes(extensionName)) return "ppt"
    else if (['png', 'jpg', 'jpeg', 'gif', 'webbp', 'ico', 'svg', 'bmp'].includes(extensionName)) return "picture"
    else if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', '3gp', 'ts', 'ogv'].includes(extensionName)) return "video"
    else if (['mp3', 'wav', 'flac', 'm4a', 'ogg', 'm4a', 'wma', 'aiff', 'aac'].includes(extensionName)) return "music"
    else if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'dmg'].includes(extensionName)) return "zip"
    else if (['md', 'html', 'htm', 'xhtml', 'xml', 'json', 'js' ,'jsx', 'css', 'tsx', 'go', 'py', 'php'].includes(extensionName)) return "code"
    return "default"
}

/**
 * 根据文件名获取文件类型图标
 * 
 * 本函数通过文件后缀名来决定文件类型的图标不同文件类型对应不同的图标，
 * 如果文件类型不匹配已知类型，则返回默认图标
 * 
 * @param fileName 文件名，用于根据后缀名判断文件类型
 * @returns 返回对应文件类型的图标名称如果无法识别文件类型，则返回默认图标
 */
export function getFileTypeIcon(fileName: string) : string {
    const fileType = getFileType(fileName);
    return  `${fileType}.png`
}

/**
 * 根据图像名称获取图像的URL
 * 
 * 此函数通过动态构建图像路径并将其转换为绝对URL，来获取存储在指定文件夹中的图像的完整URL
 * 它主要用于简化图像资源的访问，通过提供图像文件名即可获取其完整的URL路径，而无需手动处理路径和URL的转换
 * 
 * @param name 图像文件的名称，不包含路径，仅包含文件名和扩展名例如 'example.png'
 * @returns 返回图像的完整URL路径
 */
export function getImageUrl (name:string) { return new URL(`../assets/img/${name}`, import.meta.url).href;}

/**
 * 根据文件名获取文件图标URL
 * 
 * 此函数旨在根据文件的名称来获取其对应的图标URL它首先根据文件名确定文件类型，
 * 然后根据文件类型获取相应的图标文件名，最后返回该图标的URL
 * 
 * @param fileName 文件名，用于确定文件类型并获取对应图标的文件名
 * @returns 返回文件图标的URL
 */
export function getFileIconUrl (fileName: string) {
    const iconFileName = getFileTypeIcon(fileName)
    return getImageUrl(iconFileName);
}

