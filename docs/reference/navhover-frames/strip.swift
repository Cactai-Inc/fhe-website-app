import Foundation
import AVFoundation
import AppKit

// usage: strip <in.mov> <out.png> <x> <y> <w> <h> <fps> <cols> <scale>
let a = CommandLine.arguments
let url = URL(fileURLWithPath: a[1])
let outPath = a[2]
let cx = Double(a[3])!, cy = Double(a[4])!, cw = Double(a[5])!, ch = Double(a[6])!
let fps = Double(a[7])!
let cols = Int(a[8])!
let scale = Double(a[9])!

let asset = AVURLAsset(url: url)
let dur = CMTimeGetSeconds(asset.duration)
let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero

var tiles: [(Double, CGImage)] = []
var t = 0.0
while t < dur - 0.01 {
    if let cg = try? gen.copyCGImage(at: CMTime(seconds: t, preferredTimescale: 600), actualTime: nil) {
        let r = CGRect(x: cx, y: cy, width: cw, height: ch)
        if let crop = cg.cropping(to: r) { tiles.append((t, crop)) }
    }
    t += 1.0 / fps
}
print("tiles: \(tiles.count)  video dur \(String(format:"%.2f",dur))")

let labelH = 14.0
let tw = cw * scale, th = ch * scale + labelH
let rows = Int(ceil(Double(tiles.count) / Double(cols)))
let W = Int(tw * Double(cols)), H = Int(th * Double(rows))

let bmp = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: W, pixelsHigh: H,
    bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
    colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bmp)
NSColor.black.setFill()
NSRect(x: 0, y: 0, width: Double(W), height: Double(H)).fill()

let attrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.monospacedSystemFont(ofSize: 10, weight: .bold),
    .foregroundColor: NSColor.yellow
]

for (i, item) in tiles.enumerated() {
    let c = i % cols, r = i / cols
    let x = Double(c) * tw
    let yTop = Double(r) * th
    let y = Double(H) - yTop - th          // flip: AppKit origin is bottom-left
    let img = NSImage(cgImage: item.1, size: NSSize(width: cw, height: ch))
    img.draw(in: NSRect(x: x, y: y + labelH, width: tw, height: ch * scale))
    let s = String(format: "%.2fs", item.0) as NSString
    s.draw(at: NSPoint(x: x + 3, y: y + 1), withAttributes: attrs)
}
NSGraphicsContext.restoreGraphicsState()
try! bmp.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: outPath))
print("wrote \(outPath)  \(W)x\(H)")
