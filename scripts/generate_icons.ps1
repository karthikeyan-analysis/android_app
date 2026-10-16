Add-Type -AssemblyName System.Drawing

$sourceLogo = "D:\LegendaryOne\Websites\karhikeyananalysis\website\public\logo.jpeg"
$sourceBanner = "D:\LegendaryOne\Websites\karhikeyananalysis\website\public\banner.jpeg"
$assetsDir = "D:\LegendaryOne\Websites\karhikeyananalysis\student_portal\App\assets"

Copy-Item -Path $sourceLogo -Destination (Join-Path $assetsDir "logo.jpeg") -Force
Copy-Item -Path $sourceBanner -Destination (Join-Path $assetsDir "banner.jpeg") -Force

function Resize-Image {
    param(
        [string]$InputPath,
        [string]$OutputPath,
        [int]$TargetWidth,
        [int]$TargetHeight,
        [int]$Padding = 0,
        [System.Drawing.Color]$BgColor = [System.Drawing.Color]::White
    )
    $src = [System.Drawing.Image]::FromFile($InputPath)
    $dest = New-Object System.Drawing.Bitmap $TargetWidth, $TargetHeight
    $graphics = [System.Drawing.Graphics]::FromImage($dest)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear($BgColor)

    $drawWidth = $TargetWidth - (2 * $Padding)
    $drawHeight = $TargetHeight - (2 * $Padding)
    $destX = $Padding
    $destY = $Padding

    $graphics.DrawImage($src, $destX, $destY, $drawWidth, $drawHeight)
    $graphics.Dispose()
    $src.Dispose()

    $dest.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $dest.Dispose()
    Write-Host "Created: $OutputPath"
}

# 1. Main app icon: 1024x1024
Resize-Image -InputPath (Join-Path $assetsDir "logo.jpeg") -OutputPath (Join-Path $assetsDir "icon.png") -TargetWidth 1024 -TargetHeight 1024 -Padding 0

# 2. Splash icon: 1024x1024
Resize-Image -InputPath (Join-Path $assetsDir "logo.jpeg") -OutputPath (Join-Path $assetsDir "splash-icon.png") -TargetWidth 1024 -TargetHeight 1024 -Padding 80

# 3. Android adaptive icon foreground: 512x512 with safe padding (approx 15% margin for circular cutouts)
Resize-Image -InputPath (Join-Path $assetsDir "logo.jpeg") -OutputPath (Join-Path $assetsDir "android-icon-foreground.png") -TargetWidth 512 -TargetHeight 512 -Padding 50

# 4. Favicon: 48x48
Resize-Image -InputPath (Join-Path $assetsDir "logo.jpeg") -OutputPath (Join-Path $assetsDir "favicon.png") -TargetWidth 48 -TargetHeight 48 -Padding 0

Write-Host "All icons created successfully!"
