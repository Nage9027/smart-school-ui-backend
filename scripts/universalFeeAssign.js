// universalFeeAssign.js - FIXED VERSION
import { MongoClient, ObjectId } from 'mongodb';

console.log('🚀 Universal Fee Assignment Script');
console.log('='.repeat(50));

// Configuration - USING THE CORRECT DATABASE
const CONFIG = {
    DB_NAME: 'school_erp', // CORRECT: Your students are in school_erp
    COLLECTIONS: {
        STUDENTS: 'students', // From your mongoose script
        FEE_STRUCTURES: 'feestructures', // This is in ai-school-erp
        PAYMENTS: 'payments',
        RECEIPTS: 'receipts'
    },
    FEE_ASSIGNMENT_YEAR: 2025
};

class StudentFeeAssigner {
    constructor() {
        this.client = null;
        this.db = null;
        this.stats = {
            totalStudents: 0,
            processed: 0,
            feesAssigned: 0,
            skipped: 0,
            errors: 0
        };
    }

    async connect() {
        try {
            console.log('🔗 Connecting to MongoDB...');
            
            // Connect to MongoDB
            const mongoUri = 'mongodb://127.0.0.1:27017';
            this.client = new MongoClient(mongoUri);
            await this.client.connect();
            
            console.log('✅ Connected to MongoDB');
            return true;
        } catch (error) {
            console.error('❌ MongoDB connection failed:', error.message);
            throw error;
        }
    }

    async analyzeDatabaseStructure() {
        console.log('\n🔍 Analyzing database structure...');
        
        // Check what databases exist
        const adminDb = this.client.db().admin();
        const dbList = await adminDb.listDatabases();
        
        console.log('📊 Available databases:');
        dbList.databases.forEach(db => {
            console.log(`   - ${db.name}`);
        });
        
        // Check both databases
        for (const dbName of ['ai-school-erp', 'school_erp']) {
            console.log(`\n🔎 Checking database: ${dbName}`);
            const db = this.client.db(dbName);
            const collections = await db.listCollections().toArray();
            
            if (collections.length === 0) {
                console.log(`   No collections found in ${dbName}`);
                continue;
            }
            
            console.log(`   Collections in ${dbName}:`);
            collections.forEach(col => {
                console.log(`     - ${col.name}`);
            });
            
            // Check students collection if it exists
            if (collections.some(c => c.name === 'students')) {
                const studentsCol = db.collection('students');
                const count = await studentsCol.countDocuments({});
                console.log(`     Students count: ${count}`);
                
                // Show sample student
                if (count > 0) {
                    const sample = await studentsCol.findOne({});
                    console.log(`     Sample student structure:`);
                    console.log(JSON.stringify(sample, null, 2));
                }
            }
        }
    }

    async getStudentsFromSchoolERP() {
        try {
            console.log('\n📋 Fetching students from school_erp database...');
            
            const db = this.client.db('school_erp');
            const studentsCol = db.collection('students');
            
            // Count all students
            this.stats.totalStudents = await studentsCol.countDocuments({});
            console.log(`📊 Total students in school_erp: ${this.stats.totalStudents}`);
            
            if (this.stats.totalStudents === 0) {
                console.log('❌ No students found in school_erp database');
                return [];
            }
            
            // Get active students
            const students = await studentsCol.find({
                'status': 'active'
            }).toArray();
            
            console.log(`✅ Found ${students.length} active students`);
            
            // Show sample student structure
            if (students.length > 0) {
                console.log('\n📝 Sample student structure:');
                const sample = students[0];
                
                // Check different possible structures
                if (sample.student) {
                    console.log('Student has nested "student" object');
                    console.log('Name:', sample.student.firstName, sample.student.lastName);
                    console.log('Admission:', sample.admissionNumber);
                    console.log('Class:', sample.class);
                    console.log('Parents:', sample.parents || sample.father || sample.mother);
                } else {
                    console.log('Student has flat structure');
                    console.log('Full document:', JSON.stringify(sample, null, 2));
                }
            }
            
            return students;
        } catch (error) {
            console.error('❌ Error fetching students:', error.message);
            return [];
        }
    }

    async getFeeStructureFromAIERP() {
        try {
            console.log('\n💰 Fetching fee structure from ai-school-erp...');
            
            const db = this.client.db('ai-school-erp');
            const feeCol = db.collection('feestructures');
            
            // Check if collection exists
            const collections = await db.listCollections().toArray();
            const hasFeeStructure = collections.some(c => c.name === 'feestructures');
            
            if (!hasFeeStructure) {
                console.log('⚠️ feestructures collection not found in ai-school-erp');
                return null;
            }
            
            // Get active fee structure for 2025
            const feeStructure = await feeCol.findOne({
                academicYear: 2025,
                status: 'active'
            });
            
            if (feeStructure) {
                console.log(`✅ Found fee structure: ${feeStructure.name}`);
                console.log('Fee structure ID:', feeStructure._id);
                return feeStructure;
            } else {
                console.log('⚠️ No active fee structure found for 2025');
                
                // Create one if doesn't exist
                const newFeeStructure = {
                    name: 'Annual Fee 2025-26',
                    academicYear: 2025,
                    description: 'Default annual fee structure',
                    status: 'active',
                    classes: {
                        'NURSERY': 12000,
                        'LKG': 15000,
                        'UKG': 16000,
                        '1': 18000, '2': 19000, '3': 20000, '4': 21000, '5': 22000,
                        '6': 25000, '7': 26000, '8': 27000,
                        '9': 30000, '10': 32000, '11': 35000, '12': 38000
                    },
                    createdAt: new Date(),
                    createdBy: new ObjectId('693d366ffb4683aa512565f8')
                };
                
                const result = await feeCol.insertOne(newFeeStructure);
                console.log(`✅ Created new fee structure with ID: ${result.insertedId}`);
                return { ...newFeeStructure, _id: result.insertedId };
            }
        } catch (error) {
            console.error('❌ Error fetching fee structure:', error.message);
            return null;
        }
    }

    async assignFeesToStudents(students, feeStructure) {
        try {
            console.log('\n💸 Starting fee assignment...');
            
            // We need to work with ai-school-erp database for payments
            const aiErpDb = this.client.db('ai-school-erp');
            const paymentsCol = aiErpDb.collection('payments');
            
            // Ensure payments collection exists
            await aiErpDb.createCollection('payments').catch(() => {
                console.log('✓ Payments collection already exists');
            });
            
            for (const student of students) {
                try {
                    // Extract student information based on structure
                    const studentInfo = this.extractStudentInfo(student);
                    
                    if (!studentInfo.admissionNumber) {
                        console.log(`⚠️ Skipping student - no admission number: ${studentInfo.name}`);
                        this.stats.skipped++;
                        continue;
                    }
                    
                    // Check if fee already assigned
                    const existingFee = await paymentsCol.findOne({
                        admissionNumber: studentInfo.admissionNumber,
                        academicYear: CONFIG.FEE_ASSIGNMENT_YEAR
                    });
                    
                    if (existingFee) {
                        console.log(`⏭️ Skipping - Fee already assigned: ${studentInfo.name}`);
                        this.stats.skipped++;
                        continue;
                    }
                    
                    // Calculate fee based on class
                    const feeAmount = this.calculateFee(studentInfo.class, feeStructure);
                    
                    // Create payment record
                    const paymentRecord = {
                        studentId: student._id,
                        studentName: studentInfo.name,
                        admissionNumber: studentInfo.admissionNumber,
                        class: studentInfo.class,
                        academicYear: CONFIG.FEE_ASSIGNMENT_YEAR,
                        feeStructureId: feeStructure._id,
                        totalAmount: feeAmount,
                        paidAmount: 0,
                        dueAmount: feeAmount,
                        status: 'pending',
                        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        createdBy: new ObjectId('693d366ffb4683aa512565f8'),
                        breakdown: [
                            { name: 'Tuition Fee', amount: feeAmount * 0.7, category: 'academic' },
                            { name: 'Development Fee', amount: feeAmount * 0.2, category: 'facility' },
                            { name: 'Sports Fee', amount: feeAmount * 0.1, category: 'extracurricular' }
                        ]
                    };
                    
                    await paymentsCol.insertOne(paymentRecord);
                    
                    console.log(`✅ Assigned ₹${feeAmount} to ${studentInfo.name} (${studentInfo.admissionNumber})`);
                    this.stats.feesAssigned++;
                    this.stats.processed++;
                    
                } catch (error) {
                    console.error(`❌ Error processing student:`, error.message);
                    this.stats.errors++;
                }
            }
            
            console.log('\n' + '='.repeat(50));
            console.log('🎉 FEE ASSIGNMENT COMPLETE');
            console.log('='.repeat(50));
            console.log(`📊 Total Students: ${students.length}`);
            console.log(`✅ Processed: ${this.stats.processed}`);
            console.log(`💰 Fees Assigned: ${this.stats.feesAssigned}`);
            console.log(`⏭️ Skipped: ${this.stats.skipped}`);
            console.log(`❌ Errors: ${this.stats.errors}`);
            console.log('='.repeat(50));
            
        } catch (error) {
            console.error('❌ Error in fee assignment:', error.message);
        }
    }

    extractStudentInfo(student) {
        // Handle different student structures
        if (student.student) {
            // Nested structure from your mongoose script
            return {
                name: `${student.student.firstName || ''} ${student.student.lastName || ''}`.trim(),
                admissionNumber: student.admissionNumber,
                class: student.class || 'LKG',
                status: student.status || 'active'
            };
        } else if (student.name) {
            // Flat structure
            return {
                name: student.name,
                admissionNumber: student.admissionNumber || student.addressNumber,
                class: student.class || 'LKG',
                status: student.status || 'active'
            };
        } else {
            // Unknown structure, use ID
            return {
                name: `Student ${student._id.toString().slice(-6)}`,
                admissionNumber: student._id.toString(),
                class: 'LKG',
                status: 'active'
            };
        }
    }

    calculateFee(studentClass, feeStructure) {
        // Try to extract class name/number
        let className = 'LKG';
        
        if (typeof studentClass === 'object') {
            className = studentClass.name || studentClass.grade || 'LKG';
        } else if (typeof studentClass === 'string') {
            className = studentClass;
        }
        
        // Clean class name
        const cleanClass = className.toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        // Check if fee structure has class-based fees
        if (feeStructure.classes && feeStructure.classes[cleanClass]) {
            return feeStructure.classes[cleanClass];
        }
        
        // Try to extract numeric class
        const numericMatch = cleanClass.match(/\d+/);
        if (numericMatch && feeStructure.classes && feeStructure.classes[numericMatch[0]]) {
            return feeStructure.classes[numericMatch[0]];
        }
        
        // Default fees based on common patterns
        const defaultFees = {
            'NURSERY': 12000, 'LKG': 15000, 'UKG': 16000,
            '1': 18000, '2': 19000, '3': 20000, '4': 21000, '5': 22000,
            '6': 25000, '7': 26000, '8': 27000,
            '9': 30000, '10': 32000, '11': 35000, '12': 38000
        };
        
        // Check for LKG/UKG
        if (cleanClass.includes('LKG')) return 15000;
        if (cleanClass.includes('UKG')) return 16000;
        if (cleanClass.includes('NURSERY')) return 12000;
        
        // Try numeric
        if (numericMatch) {
            const num = numericMatch[0];
            return defaultFees[num] || 20000;
        }
        
        return 20000; // Default
    }

    async run() {
        try {
            // Step 1: Connect to MongoDB
            await this.connect();
            
            // Step 2: Analyze structure (optional debugging)
            await this.analyzeDatabaseStructure();
            
            // Step 3: Get students from school_erp
            const students = await this.getStudentsFromSchoolERP();
            if (students.length === 0) {
                console.log('❌ Cannot proceed - no students found');
                await this.close();
                return;
            }
            
            // Step 4: Get fee structure from ai-school-erp
            const feeStructure = await this.getFeeStructureFromAIERP();
            if (!feeStructure) {
                console.log('❌ Cannot proceed - no fee structure');
                await this.close();
                return;
            }
            
            // Step 5: Assign fees
            await this.assignFeesToStudents(students, feeStructure);
            
            // Step 6: Summary
            console.log('\n📋 FINAL SUMMARY:');
            console.log(`Total students in database: ${this.stats.totalStudents}`);
            console.log(`Fees successfully assigned: ${this.stats.feesAssigned}`);
            console.log(`Students skipped: ${this.stats.skipped}`);
            console.log(`Errors encountered: ${this.stats.errors}`);
            
        } catch (error) {
            console.error('💥 Fatal error:', error);
        } finally {
            await this.close();
        }
    }

    async close() {
        if (this.client) {
            await this.client.close();
            console.log('\n🔌 MongoDB connection closed');
        }
    }
}

// Main execution
async function main() {
    console.log('='.repeat(60));
    console.log('UNIVERSAL FEE ASSIGNMENT - CROSS DATABASE');
    console.log('Students: school_erp database');
    console.log('Fees/Payments: ai-school-erp database');
    console.log('='.repeat(60));
    
    const assigner = new StudentFeeAssigner();
    await assigner.run();
    
    console.log('\n' + '='.repeat(60));
    console.log('SCRIPT EXECUTION COMPLETE');
    console.log('='.repeat(60));
}

// Run the script
main().catch(console.error);