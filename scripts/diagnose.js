// debugAPIIssue.js
import mongoose from 'mongoose';
import Payment from '../src/models/Payment.js'; // Adjust path as needed

async function debugAPIIssue() {
    console.log('🔍 DEBUGGING API ISSUE\n');
    
    await mongoose.connect('mongodb://localhost:27017/school_erp');
    
    const admissionNumber = 'ADM-1765707297603';
    
    try {
        console.log(`1. Finding payments for: ${admissionNumber}`);
        
        // Simulate what your API should be doing
        const payments = await Payment.find({ 
            admissionNumber: admissionNumber 
        });
        
        console.log(`   Found ${payments.length} payment(s)`);
        
        if (payments.length > 0) {
            console.log('\n2. Payment details:');
            payments.forEach((payment, index) => {
                console.log(`\n   Payment ${index + 1}:`);
                console.log(`   ID: ${payment._id}`);
                console.log(`   Total Amount: ${payment.totalAmount}`);
                console.log(`   Paid Amount: ${payment.paidAmount || 0}`);
                console.log(`   Due Amount: ${payment.dueAmount || payment.totalAmount}`);
                console.log(`   Status: ${payment.status}`);
            });
            
            // Calculate what the API SHOULD return
            console.log('\n3. CALCULATION TIME:');
            
            // Method 1: Using reduce (what your API should use)
            const totalAmount = payments.reduce((sum, payment) => {
                console.log(`   Adding: ${payment.totalAmount} (from payment ${payment._id})`);
                return sum + (payment.totalAmount || 0);
            }, 0);
            
            const totalPaid = payments.reduce((sum, payment) => sum + (payment.paidAmount || 0), 0);
            const totalDue = payments.reduce((sum, payment) => sum + (payment.dueAmount || 0), totalAmount - totalPaid);
            
            console.log(`\n✅ WHAT API SHOULD RETURN:`);
            console.log(`   totalAmount: ${totalAmount}`);
            console.log(`   totalPaid: ${totalPaid}`);
            console.log(`   totalDue: ${totalDue}`);
            
            // Method 2: Manual check
            console.log('\n🔍 MANUAL CHECK:');
            let manualTotal = 0;
            for (const payment of payments) {
                const amount = payment.totalAmount;
                console.log(`   Payment ${payment._id}: totalAmount = ${amount}`);
                manualTotal += amount || 0;
            }
            console.log(`   Manual total: ${manualTotal}`);
            
            // Check if totalAmount field exists
            console.log('\n📊 FIELD CHECK:');
            const samplePayment = payments[0];
            console.log(`   Payment has totalAmount field: ${'totalAmount' in samplePayment}`);
            console.log(`   totalAmount value: ${samplePayment.totalAmount}`);
            console.log(`   totalAmount type: ${typeof samplePayment.totalAmount}`);
            console.log(`   Payment object keys: ${Object.keys(samplePayment.toObject()).join(', ')}`);
            
            // Check the database directly
            console.log('\n4. DATABASE DIRECT CHECK:');
            const db = mongoose.connection.db;
            const paymentsCol = db.collection('payments');
            const dbPayment = await paymentsCol.findOne({ 
                admissionNumber: admissionNumber 
            });
            
            if (dbPayment) {
                console.log('   Direct database query result:');
                console.log(`   _id: ${dbPayment._id}`);
                console.log(`   totalAmount: ${dbPayment.totalAmount}`);
                console.log(`   totalAmount field exists: ${'totalAmount' in dbPayment}`);
                
                // List all fields
                console.log('\n   ALL FIELDS IN DATABASE:');
                Object.keys(dbPayment).forEach(key => {
                    if (key !== '_id' && key !== '__v') {
                        console.log(`     ${key}: ${dbPayment[key]}`);
                    }
                });
            }
            
        } else {
            console.log('❌ No payments found!');
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected');
    }
}

debugAPIIssue().catch(console.error);