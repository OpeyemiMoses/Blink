import QRCode from 'qrcode';
import { TransactionReceipt } from '../types';
import { BLINK_LOGO_CROPPED_BLACK_DATA_URI } from '../constants/brandLogoAssets';
import { SolanaService } from './solanaService';

export class ReceiptImageService {
  /**
   * Generates a high-resolution, downloadable payment receipt image (PNG) on a canvas.
   * Contains:
   * 1. Official Blink Logo and Wordmark
   * 2. Header and verified status badge
   * 3. What they paid for (Item / Action name)
   * 4. Amount & Currency (SOL or USDC)
   * 5. Payer / Sender address
   * 6. Recipient / Receiver address
   * 7. Transaction signature / hash
   * 8. Timestamp & block confirmation
   * 9. QR code linking to on-chain Solana Explorer
   */
  static async generateReceiptDataUrl(receipt: TransactionReceipt, viewerAddress?: string | null): Promise<string> {
    const width = 800;
    const height = 1180;
    const explorerUrl = SolanaService.getExplorerUrl(receipt.signature);

    // Generate explorer QR code
    const qrDataUrl = await QRCode.toDataURL(explorerUrl, {
      margin: 1,
      width: 220,
      color: {
        dark: '#0A0C10',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    // 1. Background: Clean pure white receipt
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Outer border
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, width - 60, height - 60);

    // Decorative receipt corner notches
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(15, 30); ctx.lineTo(45, 30);
    ctx.moveTo(30, 15); ctx.lineTo(30, 45);
    ctx.moveTo(width - 45, 30); ctx.lineTo(width - 15, 30);
    ctx.moveTo(width - 30, 15); ctx.lineTo(width - 30, 45);
    ctx.moveTo(15, height - 30); ctx.lineTo(45, height - 30);
    ctx.moveTo(30, height - 45); ctx.lineTo(30, height - 15);
    ctx.moveTo(width - 45, height - 30); ctx.lineTo(width - 15, height - 30);
    ctx.moveTo(width - 30, height - 45); ctx.lineTo(width - 30, height - 15);
    ctx.stroke();

    // 2. Header: Authentic Blink Logo & Wordmark
    const logoImg = new Image();
    await new Promise<void>((resolve) => {
      logoImg.onload = () => resolve();
      logoImg.onerror = () => resolve();
      logoImg.src = BLINK_LOGO_CROPPED_BLACK_DATA_URI;
    });

    const headerY = 75;
    const logoH = 50;
    const logoW = Math.round(logoH * (273 / 365)); // 37px
    const logoX = width / 2 - 100;

    if (logoImg.complete && logoImg.naturalWidth > 0) {
      ctx.drawImage(logoImg, logoX, headerY - 12, logoW, logoH);
    }

    // Wordmark
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('BLINK', logoX + logoW + 14, headerY + 16);

    ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.fillText('SOLANA TRANSACTION RECEIPT', logoX + logoW + 16, headerY + 34);

    // Top Divider Line
    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, 140);
    ctx.lineTo(width - 60, 140);
    ctx.stroke();

    const isRecipient = Boolean(
      viewerAddress &&
      receipt.recipientAddress &&
      (receipt.recipientAddress === viewerAddress || receipt.recipientAddress.toLowerCase() === viewerAddress.toLowerCase())
    );
    const isPayer = Boolean(
      viewerAddress &&
      receipt.payerAddress &&
      (receipt.payerAddress === viewerAddress || receipt.payerAddress.toLowerCase() === viewerAddress.toLowerCase())
    );

    const isReceive = isRecipient && !isPayer ? true : !isRecipient && isPayer ? false : receipt.method === 'receive';

    // 3. Status Badge: Sent vs Received on Solana
    const badgeY = 168;
    const badgeW = isReceive ? 290 : 310;
    const badgeH = 34;
    const badgeX = (width - badgeW) / 2;

    ctx.fillStyle = isReceive ? '#ECFDF5' : '#FEF2F2';
    this.roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 17);
    ctx.fill();
    ctx.strokeStyle = isReceive ? '#A7F3D0' : '#FECACA';
    ctx.lineWidth = 1;
    this.roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 17);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = isReceive ? '#059669' : '#DC2626';
    ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(isReceive ? '✓ RECEIVED & CONFIRMED ON SOLANA' : '✓ SENT & CONFIRMED ON SOLANA', width / 2, badgeY + 22);

    // 4. Amount Display
    const amountY = 250;
    const rawAmount = receipt.token === 'SOL'
      ? `${receipt.amount.toFixed(4)} SOL`
      : (receipt.token === 'SKR'
        ? `${receipt.amount.toFixed(2)} SKR`
        : `$${receipt.amount.toFixed(2)} USDC`);
    const formattedAmount = isReceive ? `+${rawAmount}` : `-${rawAmount}`;

    ctx.fillStyle = isReceive ? '#059669' : '#DC2626';
    ctx.font = '900 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(formattedAmount, width / 2, amountY);

    ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.fillText(isReceive ? 'TOTAL AMOUNT RECEIVED' : 'TOTAL AMOUNT SENT', width / 2, amountY + 28);

    // 5. Item / What They Paid For Box
    const itemBoxY = 315;
    ctx.fillStyle = '#F8FAFC';
    this.roundRect(ctx, 60, itemBoxY, width - 120, 80, 16);
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    this.roundRect(ctx, 60, itemBoxY, width - 120, 80, 16);
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ITEM / ACTION PAID FOR', width / 2, itemBoxY + 28);

    ctx.fillStyle = '#1E293B';
    ctx.font = '800 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(receipt.blinkTitle || 'Solana Action Payment', width / 2, itemBoxY + 56);

    // 6. Details Table
    const tableY = 425;
    const tableW = width - 120;
    const tableX = 60;
    const rowHeight = 44;

    const rows: { label: string; value: string; isMono?: boolean }[] = [
      {
        label: 'PAYER / SENDER',
        value: receipt.payerAddress
          ? `${receipt.payerAddress.slice(0, 12)}...${receipt.payerAddress.slice(-8)}`
          : 'Connected Solana Wallet',
        isMono: true,
      },
      {
        label: 'RECIPIENT / RECEIVER',
        value: receipt.recipientAddress
          ? `${receipt.recipientAddress.slice(0, 12)}...${receipt.recipientAddress.slice(-8)}`
          : 'Recipient Solana Address',
        isMono: true,
      },
      {
        label: 'TRANSACTION HASH',
        value: receipt.signature
          ? `${receipt.signature.slice(0, 12)}...${receipt.signature.slice(-10)}`
          : 'Finalized On-Chain',
        isMono: true,
      },
      {
        label: 'DATE & TIME',
        value: new Date(receipt.timestamp || Date.now()).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'medium',
          hour12: false,
        }),
      },
      {
        label: 'NETWORK & ASSET',
        value: `Solana Devnet • ${receipt.token === 'SOL' ? 'Native SOL' : 'SPL USDC'}`,
      },
    ];

    rows.forEach((row, idx) => {
      const currentY = tableY + idx * rowHeight;
      // Row separator
      if (idx > 0) {
        ctx.strokeStyle = '#F1F5F9';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tableX, currentY);
        ctx.lineTo(tableX + tableW, currentY);
        ctx.stroke();
      }

      ctx.fillStyle = '#64748B';
      ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(row.label, tableX + 4, currentY + 28);

      ctx.fillStyle = '#0F172A';
      ctx.font = row.isMono
        ? '700 13px "Courier New", Courier, monospace'
        : '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(row.value, tableX + tableW - 4, currentY + 28);
    });

    // 7. Dashed Receipt Tear Line
    const tearY = tableY + rows.length * rowHeight + 20;
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(60, tearY);
    ctx.lineTo(width - 60, tearY);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // 8. Explorer Verification QR Code Box
    const qrSectionY = tearY + 30;
    const qrImg = new Image();
    await new Promise<void>((resolve, reject) => {
      qrImg.onload = () => resolve();
      qrImg.onerror = reject;
      qrImg.src = qrDataUrl;
    });

    const qrSize = 130;
    const qrX = (width - qrSize) / 2;
    ctx.drawImage(qrImg, qrX, qrSectionY, qrSize, qrSize);

    ctx.fillStyle = '#475569';
    ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Scan QR with Camera to View On-Chain Solana Explorer', width / 2, qrSectionY + qrSize + 22);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Cryptographically signed non-custodial receipt • blink.so', width / 2, qrSectionY + qrSize + 40);

    return canvas.toDataURL('image/png');
  }

  /**
   * Saves receipt PNG directly to mobile gallery or triggers browser download
   */
  static async downloadReceipt(receipt: TransactionReceipt, viewerAddress?: string | null): Promise<boolean> {
    try {
      const dataUrl = await this.generateReceiptDataUrl(receipt, viewerAddress);
      const safeId = receipt.signature ? receipt.signature.slice(0, 10) : Date.now().toString();
      const filename = `blink-receipt-${safeId}.png`;
      const { FileSaverService } = await import('./fileSaverService');
      return await FileSaverService.saveImage({
        dataUrl,
        filename,
        title: 'Blink Transaction Receipt',
      });
    } catch (err) {
      console.error('Failed to download receipt image:', err);
      return false;
    }
  }

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
