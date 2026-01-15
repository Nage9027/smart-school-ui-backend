import { convertToWords } from "./numberToWords.js";

export const generateReceiptHTML = (payment, receipt) => {
  const { schoolDetails, studentDetails, paymentDetails, amountDetails, feesBreakdown } = receipt;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Receipt ${receipt.receiptNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .receipt-container { max-width: 800px; margin: 0 auto; }
        .receipt { background: white; border: 2px solid #000; padding: 40px; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 25px; margin-bottom: 30px; }
        .school-name { font-size: 32px; font-weight: 700; margin-bottom: 8px; color: #2c3e50; }
        .school-tagline { font-size: 16px; color: #7f8c8d; margin-bottom: 15px; font-style: italic; }
        .school-info { font-size: 13px; line-height: 1.6; color: #34495e; }
        .receipt-title { font-size: 28px; text-align: center; margin: 25px 0; font-weight: 700; color: #2c3e50; text-transform: uppercase; letter-spacing: 1px; }
        .section { margin: 25px 0; }
        .section-title { font-weight: 600; border-bottom: 2px solid #3498db; padding-bottom: 8px; margin-bottom: 15px; color: #2c3e50; font-size: 16px; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .detail-item { margin: 8px 0; }
        .detail-label { font-weight: 600; color: #2c3e50; display: inline-block; min-width: 180px; }
        .amount-table { width: 100%; border-collapse: collapse; margin: 25px 0; border: 1px solid #ddd; }
        .amount-table th { background: #3498db; color: white; padding: 12px; text-align: left; font-weight: 600; }
        .amount-table td { padding: 12px; border-bottom: 1px solid #ddd; }
        .total-row { font-weight: 700; background: #f8f9fa; color: #2c3e50; }
        .amount-words { font-style: italic; margin: 25px 0; padding: 15px; background: #f8f9fa; border-left: 4px solid #3498db; }
        .signature { margin-top: 80px; text-align: center; }
        .signature-line { width: 300px; border-top: 1px solid #000; margin: 40px auto 10px; }
        .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #7f8c8d; border-top: 1px solid #ddd; padding-top: 15px; }
        .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 80px; color: rgba(0,0,0,0.05); z-index: -1; font-weight: bold; }
        @media print {
          body { margin: 0; background: white; }
          .no-print { display: none; }
          .receipt { border: none; box-shadow: none; padding: 20px; }
          .watermark { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="watermark">PAID</div>
      <div class="receipt-container">
        <div class="receipt">
          <div class="header">
            <div class="school-name">${schoolDetails.name}</div>
            <div class="school-tagline">Smart Education Management System</div>
            <div class="school-info">
              ${schoolDetails.address}<br/>
              Phone: ${schoolDetails.phone} | Email: ${schoolDetails.email}<br/>
              Registration No: ${schoolDetails.registrationNo} | GSTIN: ${schoolDetails.gstin}
            </div>
          </div>
          
          <div class="receipt-title">FEE PAYMENT RECEIPT</div>
          
          <div class="section">
            <div class="section-title">Receipt Details</div>
            <div class="details-grid">
              <div class="detail-item"><span class="detail-label">Receipt No:</span> ${receipt.receiptNumber}</div>
              <div class="detail-item"><span class="detail-label">Date:</span> ${new Date(paymentDetails.date).toLocaleDateString('en-IN')}</div>
              <div class="detail-item"><span class="detail-label">Academic Year:</span> 2024-2025</div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Student Details</div>
            <div class="details-grid">
              <div class="detail-item"><span class="detail-label">Student Name:</span> ${studentDetails.name}</div>
              <div class="detail-item"><span class="detail-label">Admission No:</span> ${studentDetails.admissionNumber}</div>
              <div class="detail-item"><span class="detail-label">Class & Section:</span> ${studentDetails.className} - ${studentDetails.section}</div>
              <div class="detail-item"><span class="detail-label">Parent Name:</span> ${studentDetails.parentName}</div>
              <div class="detail-item"><span class="detail-label">Parent Contact:</span> ${studentDetails.parentPhone}</div>
              <div class="detail-item"><span class="detail-label">Parent Email:</span> ${studentDetails.parentEmail || 'N/A'}</div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Payment Details</div>
            <div class="details-grid">
              <div class="detail-item"><span class="detail-label">Payment Method:</span> ${paymentDetails.method.toUpperCase()}</div>
              <div class="detail-item"><span class="detail-label">Reference No:</span> ${paymentDetails.reference || 'N/A'}</div>
              ${paymentDetails.bankName ? `<div class="detail-item"><span class="detail-label">Bank Name:</span> ${paymentDetails.bankName}</div>` : ''}
              ${paymentDetails.chequeNo ? `<div class="detail-item"><span class="detail-label">Cheque No:</span> ${paymentDetails.chequeNo}</div>` : ''}
            </div>
          </div>
          
          <table class="amount-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Fee Amount</td>
                <td>${amountDetails.totalAmount.toLocaleString('en-IN')}</td>
              </tr>
              ${amountDetails.discount > 0 ? `
              <tr>
                <td>Discount (${amountDetails.discountReason || 'General'})</td>
                <td>- ${amountDetails.discount.toLocaleString('en-IN')}</td>
              </tr>
              ` : ''}
              ${amountDetails.lateFee > 0 ? `
              <tr>
                <td>Late Fee (${amountDetails.lateFeeReason || 'Late Payment'})</td>
                <td>+ ${amountDetails.lateFee.toLocaleString('en-IN')}</td>
              </tr>
              ` : ''}
              <tr class="total-row">
                <td>TOTAL AMOUNT PAYABLE</td>
                <td><strong>₹ ${amountDetails.netAmount.toLocaleString('en-IN')}</strong></td>
              </tr>
            </tbody>
          </table>
          
          <div class="amount-words">
            <strong>Amount in Words:</strong> ${amountDetails.amountInWords}
          </div>
          
          ${feesBreakdown.length > 0 ? `
          <div class="section">
            <div class="section-title">Fees Paid</div>
            <ul style="list-style: none; padding: 0;">
              ${feesBreakdown.map(fee => `
                <li style="padding: 5px 0; border-bottom: 1px dashed #ddd;">
                  <strong>${fee.feeType}</strong> - Amount: ₹${fee.amount.toLocaleString('en-IN')} ${fee.dueDate ? `- Due: ${new Date(fee.dueDate).toLocaleDateString('en-IN')}` : ''}
                </li>
              `).join('')}
            </ul>
          </div>
          ` : ''}
          
          <div class="signature">
            <div class="signature-line"></div>
            <div style="margin-top: 10px;">
              <strong style="font-size: 16px;">${schoolDetails.principal}</strong><br/>
              <span style="color: #7f8c8d;">Principal</span><br/>
              ${schoolDetails.name}
            </div>
          </div>
          
          <div class="footer">
            <em>This is a computer generated receipt. No signature required.</em><br/>
            <span style="color: #e74c3c;">Please keep this receipt for future reference.</span>
          </div>
        </div>
        
        <div class="no-print" style="text-align: center; margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
          <button onclick="window.print()" style="padding: 12px 30px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; margin: 10px;">
            🖨️ Print Receipt
          </button>
          <button onclick="window.close()" style="padding: 12px 30px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; margin: 10px;">
            ✖️ Close
          </button>
        </div>
      </div>
      
      <script>
        window.onload = function() {
          // Auto-print if needed
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('print') === 'true') {
            setTimeout(() => {
              window.print();
            }, 1000);
          }
        };
      </script>
    </body>
    </html>
  `;
};

// Generate receipt number function
export const generateReceiptNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `REC-${year}${month}${day}-${random}`;
};