import Foundation
import AVFoundation
import AppKit
let a = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: a[1]))
let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.requestedTimeToleranceBefore = .zero; gen.requestedTimeToleranceAfter = .zero
let cx=32.0, cy=838.0, cw=250.0, ch=46.0
let start=19.25, end=19.85, fps=30.0, scale=3.0, labelH=16.0
var tiles:[(Double,CGImage)]=[]
var t=start
while t<=end { if let cg=try? gen.copyCGImage(at: CMTime(seconds:t,preferredTimescale:600),actualTime:nil),
  let c=cg.cropping(to: CGRect(x:cx,y:cy,width:cw,height:ch)) { tiles.append((t,c)) }; t += 1.0/fps }
let tw=cw*scale, th=ch*scale+labelH
let W=Int(tw), H=Int(th*Double(tiles.count))
let b=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:W,pixelsHigh:H,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:b)
NSColor.black.setFill(); NSRect(x:0,y:0,width:Double(W),height:Double(H)).fill()
let at:[NSAttributedString.Key:Any]=[.font:NSFont.monospacedSystemFont(ofSize:12,weight:.bold),.foregroundColor:NSColor.yellow]
for (i,it) in tiles.enumerated() {
  let y=Double(H)-Double(i+1)*th
  NSImage(cgImage:it.1,size:NSSize(width:cw,height:ch)).draw(in:NSRect(x:0,y:y+labelH,width:tw,height:ch*scale))
  (String(format:"%.3fs",it.0) as NSString).draw(at:NSPoint(x:4,y:y+1),withAttributes:at)
}
NSGraphicsContext.restoreGraphicsState()
try! b.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:a[2]))
print("wrote \(a[2]) \(W)x\(H) tiles=\(tiles.count)")
