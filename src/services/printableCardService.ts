import QRCode from 'qrcode';
import { PhysicalBlink, PhysicalBlinkRegistry } from './physicalBlinkRegistry';
import { BLINK_LOGO_CROPPED_BLACK_DATA_URI } from '../constants/brandLogoAssets';

export class PrintableCardService {
  /**
   * Generates a high-resolution printable placard image (PNG) on a canvas
   * containing:
   * 1. Official Blink Logo and "BLINK" Wordmark
   * 2. High-contrast, scannable QR Code
   * 3. Name of the Blink
   * 4. Recipient Name / Action Type
   * 5. Shortened Solana Address
   * 6. Verified Domain (if present)
   * 7. Price / Amount & Currency Tag (SOL or USDC on Solana)
   * 8. Point-of-Sale / Physical Tap NFC Instructions
   */
  static async generateCardDataUrl(blink: PhysicalBlink): Promise<string> {
    const width = 800;
    const height = 1120;
    const qrUrl = PhysicalBlinkRegistry.getShareableUrl(blink);

    // 1. Generate high-res QR code image data URL
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      margin: 1,
      width: 360,
      color: {
        dark: '#0A0C10',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    });

    // 2. Setup canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    // 3. Background: Crisp white with subtle printer border & cut guidelines
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Outer printable border (sleek POS placard)
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, width - 60, height - 60);

    // Decorative corner cut marks
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // top-left
    ctx.moveTo(15, 30); ctx.lineTo(45, 30);
    ctx.moveTo(30, 15); ctx.lineTo(30, 45);
    // top-right
    ctx.moveTo(width - 45, 30); ctx.lineTo(width - 15, 30);
    ctx.moveTo(width - 30, 15); ctx.lineTo(width - 30, 45);
    // bottom-left
    ctx.moveTo(15, height - 30); ctx.lineTo(45, height - 30);
    ctx.moveTo(30, height - 45); ctx.lineTo(30, height - 15);
    // bottom-right
    ctx.moveTo(width - 45, height - 30); ctx.lineTo(width - 15, height - 30);
    ctx.moveTo(width - 30, height - 45); ctx.lineTo(width - 30, height - 15);
    ctx.stroke();

    // 4. Header Bar: Authentic Blink Logo & Wordmark
    const logoImg = new Image();
    await new Promise<void>((resolve) => {
      logoImg.onload = () => resolve();
      logoImg.onerror = () => resolve();
      logoImg.src = BLINK_LOGO_CROPPED_BLACK_DATA_URI;
    });

    const headerY = 75;
    // Aspect ratio of logo_cropped_black is 273 x 365
    const logoH = 54;
    const logoW = Math.round(logoH * (273 / 365)); // 40px
    const logoX = width / 2 - 110;

    if (logoImg.complete && logoImg.naturalWidth > 0) {
      ctx.drawImage(logoImg, logoX, headerY - 14, logoW, logoH);
    }

    // Wordmark: "BLINK"
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('BLINK', logoX + logoW + 14, headerY + 16);

    // Sub-badge: "SOLANA PHYSICAL ACTION"
    ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.fillText('SOLANA PHYSICAL ACTION', logoX + logoW + 16, headerY + 34);

    // 5. Divider Line
    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, 142);
    ctx.lineTo(width - 60, 142);
    ctx.stroke();

    // 6. Blink Name (Large, Bold, Centered)
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = '800 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    
    // Auto-wrap title if too long
    const nameText = blink.name || 'Solana Blink';
    if (nameText.length > 28) {
      ctx.font = '800 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    }
    ctx.fillText(nameText, width / 2, 195);

    // 7. Amount & Currency Tag (Prominent Pill)
    const pricePillY = 225;
    const priceText = blink.token === 'SOL'
      ? `${blink.amount} SOL`
      : `$${blink.amount.toFixed(2)} USDC`;

    ctx.font = '800 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const priceMetrics = ctx.measureText(priceText);
    const pillWidth = Math.max(160, priceMetrics.width + 50);
    const pillHeight = 44;
    const pillX = width / 2 - pillWidth / 2;

    ctx.fillStyle = '#EEF2FF';
    this.roundRect(ctx, pillX, pricePillY, pillWidth, pillHeight, 22);
    ctx.fill();

    ctx.strokeStyle = '#C7D2FE';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, pillX, pricePillY, pillWidth, pillHeight, 22);
    ctx.stroke();

    ctx.fillStyle = '#4F46E5';
    ctx.textAlign = 'center';
    ctx.fillText(priceText, width / 2, pricePillY + 30);

    // 8. QR Code Display Card Box (Shadow & Rounded Border)
    const qrCardSize = 420;
    const qrCardX = (width - qrCardSize) / 2;
    const qrCardY = 300;

    // Card background
    ctx.fillStyle = '#FFFFFF';
    this.roundRect(ctx, qrCardX, qrCardY, qrCardSize, qrCardSize, 24);
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    this.roundRect(ctx, qrCardX, qrCardY, qrCardSize, qrCardSize, 24);
    ctx.stroke();

    // Draw the QR Code image
    const qrImg = new Image();
    await new Promise<void>((resolve, reject) => {
      qrImg.onload = () => resolve();
      qrImg.onerror = reject;
      qrImg.src = qrDataUrl;
    });

    const qrInnerSize = 350;
    const qrInnerX = (width - qrInnerSize) / 2;
    const qrInnerY = qrCardY + (qrCardSize - qrInnerSize) / 2;
    ctx.drawImage(qrImg, qrInnerX, qrInnerY, qrInnerSize, qrInnerSize);

    // 9. Recipient & Identifier Metadata Section
    const metaStartY = 760;

    // Recipient Name / Action Type Row
    const actionLabel = (blink.actionType || 'Payment').toUpperCase();
    ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.fillText(`ACTION TYPE: ${actionLabel}`, width / 2, metaStartY);

    // Recipient Address (Shortened e.g. 7xKX...sAsU)
    const recipientAddr = blink.recipient || '';
    const shortAddr = recipientAddr.length > 12
      ? `${recipientAddr.slice(0, 6)}...${recipientAddr.slice(-6)}`
      : recipientAddr;

    ctx.font = '700 15px "Courier New", Courier, monospace';
    ctx.fillStyle = '#1E293B';
    ctx.fillText(`RECIPIENT: ${shortAddr}`, width / 2, metaStartY + 26);

    // Verified Domain (if provided)
    if (blink.verifiedDomain) {
      const domainY = metaStartY + 56;
      ctx.font = '700 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#059669';
      ctx.fillText(`✓ Verified Domain: ${blink.verifiedDomain}`, width / 2, domainY);
    }

    // Blink ID
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(`ID: ${blink.id} • blink.so/t/${blink.id}`, width / 2, metaStartY + (blink.verifiedDomain ? 86 : 60));

    // 10. Footer Instructions Banner
    const footerY = height - 145;
    ctx.fillStyle = '#F8FAFC';
    this.roundRect(ctx, 50, footerY, width - 100, 75, 16);
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    this.roundRect(ctx, 50, footerY, width - 100, 75, 16);
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Tap with Phone (NFC) or Scan QR with Camera', width / 2, footerY + 32);

    ctx.fillStyle = '#64748B';
    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Non-custodial Solana transaction • Supports SOL & USDC on Solana Network', width / 2, footerY + 54);

    return canvas.toDataURL('image/png');
  }

  /**
   * Triggers a browser download of the printable card image
   */
  static async downloadCard(blink: PhysicalBlink): Promise<boolean> {
    try {
      const dataUrl = await this.generateCardDataUrl(blink);
      const link = document.createElement('a');
      link.download = `blink-${blink.id}-printable-card.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    } catch (err) {
      console.error('Failed to download printable card image:', err);
      return false;
    }
  }

  /**
   * Helper to draw rounded rectangle paths
   */
  private static roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}
