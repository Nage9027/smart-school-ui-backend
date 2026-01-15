import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const generatePDFReport = async (data, fileName) => {
  return new Promise((resolve, reject) => {
    try {
      const filePath = path.join(__dirname, `../temp/${fileName}.pdf`);
      
      // Create temp directory if it doesn't exist
      if (!fs.existsSync(path.join(__dirname, '../temp'))) {
        fs.mkdirSync(path.join(__dirname, '../temp'), { recursive: true });
      }

      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);
      
      doc.pipe(stream);

      // Add header
      doc.fontSize(20).text('Financial Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`);
      doc.moveDown();
      
      // Add report type
      doc.fontSize(16).text(`Report Type: ${data.reportType.toUpperCase()}`);
      doc.moveDown();
      
      // Add summary section
      if (data.summary) {
        doc.fontSize(14).text('Summary:');
        doc.fontSize(12).text(`Total Amount: ₹${data.summary.totalAmount.toLocaleString('en-IN')}`);
        doc.text(`Total Transactions: ${data.summary.totalTransactions}`);
        doc.text(`Success Rate: ${data.summary.successRate.toFixed(1)}%`);
        doc.moveDown();
      }
      
      // Add details based on report type
      switch (data.reportType) {
        case 'collection':
          if (data.dailyTrend && data.dailyTrend.length > 0) {
            doc.fontSize(14).text('Daily Trend:');
            data.dailyTrend.forEach(item => {
              doc.text(`${item.date}: ₹${item.amount.toLocaleString('en-IN')} (${item.transactions} transactions)`);
            });
          }
          break;
          
        case 'defaulter':
          if (data.defaulters && data.defaulters.length > 0) {
            doc.fontSize(14).text('Top Defaulters:');
            data.defaulters.slice(0, 10).forEach((defaulter, index) => {
              doc.text(`${index + 1}. ${defaulter.studentName} - ₹${defaulter.totalDue.toLocaleString('en-IN')}`);
            });
          }
          break;
      }
      
      doc.end();
      
      stream.on('finish', () => {
        resolve(filePath);
      });
      
      stream.on('error', reject);
      
    } catch (error) {
      reject(error);
    }
  });
};

export const generateExcelReport = async (data, fileName) => {
  try {
    const filePath = path.join(__dirname, `../temp/${fileName}.xlsx`);
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(path.join(__dirname, '../temp'))) {
      fs.mkdirSync(path.join(__dirname, '../temp'), { recursive: true });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');
    
    // Add headers
    worksheet.addRow(['Financial Report', 'Generated', new Date().toLocaleString()]);
    worksheet.addRow(['Report Type', data.reportType.toUpperCase()]);
    worksheet.addRow([]);
    
    // Add summary
    if (data.summary) {
      worksheet.addRow(['SUMMARY']);
      worksheet.addRow(['Total Amount', `₹${data.summary.totalAmount.toLocaleString('en-IN')}`]);
      worksheet.addRow(['Total Transactions', data.summary.totalTransactions]);
      worksheet.addRow(['Success Rate', `${data.summary.successRate.toFixed(1)}%`]);
      worksheet.addRow([]);
    }
    
    // Add data based on report type
    switch (data.reportType) {
      case 'collection':
        if (data.dailyTrend && data.dailyTrend.length > 0) {
          worksheet.addRow(['DAILY TREND']);
          worksheet.addRow(['Date', 'Amount', 'Transactions']);
          data.dailyTrend.forEach(item => {
            worksheet.addRow([item.date, item.amount, item.transactions]);
          });
        }
        break;
        
      case 'defaulter':
        if (data.defaulters && data.defaulters.length > 0) {
          worksheet.addRow(['DEFAULTERS LIST']);
          worksheet.addRow(['Student Name', 'Class', 'Total Due', 'Pending Count']);
          data.defaulters.forEach(defaulter => {
            worksheet.addRow([
              defaulter.studentName,
              defaulter.className,
              defaulter.totalDue,
              defaulter.pendingCount
            ]);
          });
        }
        break;
        
      case 'payment-methods':
        if (data.methodDistribution && data.methodDistribution.length > 0) {
          worksheet.addRow(['PAYMENT METHOD DISTRIBUTION']);
          worksheet.addRow(['Method', 'Total Amount', 'Count', 'Average Amount']);
          data.methodDistribution.forEach(method => {
            worksheet.addRow([
              method.method,
              method.totalAmount,
              method.count,
              method.avgAmount
            ]);
          });
        }
        break;
    }
    
    // Style the header row
    worksheet.getRow(1).font = { bold: true, size: 14 };
    worksheet.getRow(4).font = { bold: true };
    
    await workbook.xlsx.writeFile(filePath);
    return filePath;
    
  } catch (error) {
    console.error('Excel generation error:', error);
    throw error;
  }
};

export const generateCSVReport = async (data, fileName) => {
  try {
    const filePath = path.join(__dirname, `../temp/${fileName}.csv`);
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(path.join(__dirname, '../temp'))) {
      fs.mkdirSync(path.join(__dirname, '../temp'), { recursive: true });
    }

    let csvContent = '';
    
    // Add header
    csvContent += 'Financial Report\n';
    csvContent += `Generated,${new Date().toLocaleString()}\n`;
    csvContent += `Report Type,${data.reportType.toUpperCase()}\n\n`;
    
    // Add data based on report type
    switch (data.reportType) {
      case 'collection':
        if (data.dailyTrend && data.dailyTrend.length > 0) {
          csvContent += 'Daily Trend\n';
          csvContent += 'Date,Amount,Transactions\n';
          data.dailyTrend.forEach(item => {
            csvContent += `${item.date},${item.amount},${item.transactions}\n`;
          });
        }
        break;
        
      case 'defaulter':
        if (data.defaulters && data.defaulters.length > 0) {
          csvContent += 'Defaulters List\n';
          csvContent += 'Student Name,Class,Total Due,Pending Count\n';
          data.defaulters.forEach(defaulter => {
            csvContent += `${defaulter.studentName},${defaulter.className},${defaulter.totalDue},${defaulter.pendingCount}\n`;
          });
        }
        break;
    }
    
    fs.writeFileSync(filePath, csvContent);
    return filePath;
    
  } catch (error) {
    console.error('CSV generation error:', error);
    throw error;
  }
};