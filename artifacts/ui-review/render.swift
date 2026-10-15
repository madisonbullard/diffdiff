import AppKit
import Foundation

// Rasterize real OpenTUI frame spans without reflowing or reconstructing UI layout.
let root = CommandLine.arguments[1]
let manager = FileManager.default
let enumerator = manager.enumerator(atPath: root)!
let font = NSFont(name: "Menlo", size: 16)!
let bold = NSFont(name: "Menlo-Bold", size: 16)!
let cellWidth = ("M" as NSString).size(withAttributes: [.font: font]).width
let cellHeight: CGFloat = 22
func color(_ values: [Double]) -> NSColor {
    NSColor(srgbRed: values[0], green: values[1], blue: values[2], alpha: 1)
}
while let path = enumerator.nextObject() as? String {
    guard path.hasSuffix(".json"), path != "manifest.json" else { continue }
    let url = URL(fileURLWithPath: root).appendingPathComponent(path)
    let frame = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
    let cols = frame["width"] as! Int, rows = frame["height"] as! Int
    let w = Int(ceil(CGFloat(cols) * cellWidth)), h = Int(CGFloat(rows) * cellHeight)
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    let lines = frame["lines"] as! [[[String: Any]]]
    for (row, spans) in lines.enumerated() {
        var col = 0
        for span in spans {
            let width = span["width"] as! Int
            let rect = NSRect(x: CGFloat(col) * cellWidth, y: CGFloat(h) - CGFloat(row + 1) * cellHeight, width: CGFloat(width) * cellWidth, height: cellHeight)
            color(span["bg"] as! [Double]).setFill()
            rect.fill()
            let attributes = span["attributes"] as! Int
            let text = span["text"] as! String
            (text as NSString).draw(at: NSPoint(x: rect.minX, y: rect.minY + 2), withAttributes: [.font: attributes & 1 != 0 ? bold : font, .foregroundColor: color(span["fg"] as! [Double])])
            col += width
        }
    }
    NSGraphicsContext.restoreGraphicsState()
    try bitmap.representation(using: .png, properties: [:])!.write(to: url.deletingPathExtension().appendingPathExtension("png"))
    print("Rendered \(path)")
}
