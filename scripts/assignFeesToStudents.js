// scripts/simpleFeeAssign.js
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

// Fee configuration (same as above)
const feeConfig = {
  "10th Class": { baseFee: 50000, transportFee: 25000, activityFee: 5000, examFee: 3000, otherFees: 2000 },
  "11th Class": { baseFee: 55000, transportFee: 25000, activityFee: 5500, examFee: 3500, otherFees: 2500 },
  "12th Class": { baseFee: 60000, transportFee: 25000, activityFee: 6000, examFee: 4000, otherFees: 3000 },
  "LKG": { baseFee: 20000, transportFee: 20000, activityFee: 3000, examFee: 1000, otherFees: 1000 },
  "UKG": { baseFee: 22000, transportFee: 20000, activityFee: 3500, examFee: 1500, otherFees: 1500 },
  "1st Class": { baseFee: 25000, transportFee: 22000, activityFee: 4000, examFee: 2000, otherFees: 2000 },
};

async function assignFees() {
  let client;
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    client = new MongoClient(uri);
    
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('smart-school');
    
    // Get all active students
    const students = await db.collection('students').find({ status: 'active' }).toArray();
    console.log(`📊 Found ${students.length} active students`);
    
    let created = 0;
    let skipped = 0;
    
    for (const student of students) {
      try {
        // Check if fee structure already exists
        const existingFee = await db.collection('feestructures').findOne({
          admissionNumber: student.admissionNumber,
        });
        
        if (existingFee) {
          console.log(`⏭️  Fee exists: ${student.admissionNumber}`);
          skipped++;
          continue;
        }
        
        // Create fee structure
        const className = student.class?.className || '10th Class';
        const config = feeConfig[className] || feeConfig['10th Class'];
        const transportFee = student.transport === 'yes' ? config.transportFee : 0;
        const totalFee = config.baseFee + transportFee + config.activityFee + config.examFee + config.otherFees;
        
        const feeStructure = {
          admissionNumber: student.admissionNumber,
          studentId: student._id,
          studentName: `${student.student?.firstName || ''} ${student.student?.lastName || ''}`.trim(),
          className: student.class?.className || '10th Class',
          section: student.class?.section || 'A',
          academicYear: student.class?.academicYear || '2024-2025',
          transportOpted: student.transport === 'yes',
          transportFee: transportFee,
          totalFee: totalFee,
          totalPaid: 0,
          totalDue: totalFee,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        await db.collection('feestructures').insertOne(feeStructure);
        created++;
        console.log(`✅ Created: ${student.admissionNumber} - ₹${totalFee}`);
        
      } catch (error) {
        console.error(`❌ Error: ${student.admissionNumber} - ${error.message}`);
      }
    }
    
    console.log('\n📈 Summary:');
    console.log(`Created: ${created}, Skipped: ${skipped}, Total: ${students.length}`);
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Connection closed');
    }
  }
}

// Run
assignFees();