import AppKit
import Foundation

let inputPath = "/Users/jinchiwei/arcadia/orchard/thinkpad/thinkpad deconstructed.png"
let defaultOutputPath = "/Users/jinchiwei/arcadia/orchard/thinkpad/thinkpad deconstructed.transparent.png"

let logoRect = CGRect(x: 1350, y: 740, width: 250, height: 160)

struct Pixel {
    var r: UInt8
    var g: UInt8
    var b: UInt8
    var a: UInt8
}

struct RGBColor {
    var r: UInt8
    var g: UInt8
    var b: UInt8
}

func parseColor(_ value: String) -> RGBColor? {
    let named: [String: RGBColor] = [
        "white": RGBColor(r: 255, g: 255, b: 255),
        "deeppink": RGBColor(r: 255, g: 20, b: 147),
    ]
    if let match = named[value.lowercased()] {
        return match
    }

    let hex = value.hasPrefix("#") ? String(value.dropFirst()) : value
    guard hex.count == 6, let raw = Int(hex, radix: 16) else {
        return nil
    }

    return RGBColor(
        r: UInt8((raw >> 16) & 0xFF),
        g: UInt8((raw >> 8) & 0xFF),
        b: UInt8(raw & 0xFF)
    )
}

func isRedAccent(_ pixel: Pixel) -> Bool {
    Int(pixel.r) > 120 && Int(pixel.g) < 100 && Int(pixel.b) < 100
}

func makeTransparentLineArt(from pixel: Pixel, color: RGBColor) -> Pixel {
    let alpha = max(pixel.r, max(pixel.g, pixel.b))
    if alpha == 0 {
        return Pixel(r: color.r, g: color.g, b: color.b, a: 0)
    }
    return Pixel(r: color.r, g: color.g, b: color.b, a: alpha)
}

let arguments = CommandLine.arguments
var outputPath = defaultOutputPath
var lineColor = RGBColor(r: 255, g: 255, b: 255)
var forceOpaque = false

var index = 1
while index < arguments.count {
    let argument = arguments[index]
    switch argument {
    case "--output":
        index += 1
        guard index < arguments.count else {
            fputs("Missing value for --output\n", stderr)
            exit(1)
        }
        outputPath = arguments[index]
    case "--color":
        index += 1
        guard index < arguments.count else {
            fputs("Missing value for --color\n", stderr)
            exit(1)
        }
        guard let parsed = parseColor(arguments[index]) else {
            fputs("Unsupported color '\(arguments[index])'. Use a named color or #RRGGBB.\n", stderr)
            exit(1)
        }
        lineColor = parsed
    case "--opaque":
        forceOpaque = true
    default:
        fputs("Unknown argument '\(argument)'\n", stderr)
        exit(1)
    }
    index += 1
}

guard
    let image = NSImage(contentsOfFile: inputPath)
else {
    fputs("Unable to load input image at \(inputPath)\n", stderr)
    exit(1)
}

var proposedRect = NSRect(origin: .zero, size: image.size)
guard
    let sourceCG = image.cgImage(forProposedRect: &proposedRect, context: nil, hints: nil)
else {
    fputs("Unable to create CGImage from source image\n", stderr)
    exit(1)
}

let width = sourceCG.width
let height = sourceCG.height
let bytesPerPixel = 4
let bytesPerRow = width * bytesPerPixel
let bitsPerComponent = 8

guard
    let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
    let ctx = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: bitsPerComponent,
        bytesPerRow: bytesPerRow,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )
else {
    fputs("Unable to create output graphics context\n", stderr)
    exit(1)
}

ctx.draw(sourceCG, in: CGRect(x: 0, y: 0, width: width, height: height))

guard let data = ctx.data else {
    fputs("Unable to access output image buffer\n", stderr)
    exit(1)
}

let pixelBuffer = data.bindMemory(to: UInt8.self, capacity: width * height * bytesPerPixel)

for y in 0..<height {
    for x in 0..<width {
        let offset = y * bytesPerRow + x * bytesPerPixel
        var pixel = Pixel(
            r: pixelBuffer[offset],
            g: pixelBuffer[offset + 1],
            b: pixelBuffer[offset + 2],
            a: pixelBuffer[offset + 3]
        )

        let point = CGPoint(x: x, y: y)
        if logoRect.contains(point) || isRedAccent(pixel) {
            pixel = Pixel(r: 255, g: 255, b: 255, a: 0)
        } else {
            pixel = makeTransparentLineArt(from: pixel, color: lineColor)
            if forceOpaque, pixel.a > 0 {
                pixel.a = 255
            }
        }

        pixelBuffer[offset] = pixel.r
        pixelBuffer[offset + 1] = pixel.g
        pixelBuffer[offset + 2] = pixel.b
        pixelBuffer[offset + 3] = pixel.a
    }
}

guard
    let outputCG = ctx.makeImage()
else {
    fputs("Unable to create output CGImage\n", stderr)
    exit(1)
}

let bitmapRep = NSBitmapImageRep(cgImage: outputCG)

guard
    let pngData = bitmapRep.representation(using: .png, properties: [:])
else {
    fputs("Unable to encode output PNG\n", stderr)
    exit(1)
}

do {
    try pngData.write(to: URL(fileURLWithPath: outputPath))
    print("Wrote \(outputPath)")
} catch {
    fputs("Failed to write output image: \(error)\n", stderr)
    exit(1)
}
