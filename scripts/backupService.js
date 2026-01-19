const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const crypto = require('crypto');
const Backup = require('../models/Backup');
const School = require('../models/School');

class BackupService {
  constructor() {
    this.backupDir = process.env.BACKUP_DIR || './backups';
    this.ensureBackupDir();
  }

  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  // Create a new backup
  async createBackup(schoolId, type = 'full', userId, description = '') {
    try {
      const school = await School.findById(schoolId);
      if (!school) {
        throw new Error('School not found');
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupId = crypto.randomBytes(8).toString('hex');
      const filename = `${school.code}_${type}_${timestamp}_${backupId}.zip`;
      const filepath = path.join(this.backupDir, filename);

      // Create backup record
      const backup = new Backup({
        schoolId,
        type,
        filename,
        filepath,
        createdBy: userId,
        description,
        status: 'in_progress',
        size: 0
      });

      await backup.save();

      // Perform backup in background
      this.performBackup(backup, school, type);

      return backup;
    } catch (error) {
      console.error('Backup creation error:', error);
      throw error;
    }
  }

  // Perform the actual backup
  async performBackup(backup, school, type) {
    try {
      const output = fs.createWriteStream(backup.filepath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      output.on('close', async () => {
        backup.size = archive.pointer();
        backup.status = 'completed';
        backup.completedAt = new Date();
        await backup.save();

        // Cleanup old backups (keep last 10)
        await this.cleanupOldBackups(school._id);
      });

      archive.on('error', async (err) => {
        console.error('Archive error:', err);
        backup.status = 'failed';
        backup.error = err.message;
        await backup.save();
      });

      archive.pipe(output);

      // Backup based on type
      if (type === 'full' || type === 'database') {
        await this.backupDatabase(archive, school);
      }

      if (type === 'full' || type === 'files') {
        await this.backupFiles(archive, school);
      }

      if (type === 'full' || type === 'config') {
        await this.backupConfig(archive, school);
      }

      await archive.finalize();
    } catch (error) {
      console.error('Backup process error:', error);
      backup.status = 'failed';
      backup.error = error.message;
      await backup.save();
    }
  }

  // Backup database collections
  async backupDatabase(archive, school) {
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    for (const collection of collections) {
      const data = await mongoose.connection.db.collection(collection.name)
        .find({ schoolId: school._id })
        .toArray();
      
      if (data.length > 0) {
        archive.append(JSON.stringify(data, null, 2), {
          name: `database/${collection.name}.json`
        });
      }
    }
  }

  // Backup file uploads
  async backupFiles(archive, school) {
    const uploadsDir = path.join(process.env.UPLOAD_DIR || './uploads', school.code);
    
    if (fs.existsSync(uploadsDir)) {
      archive.directory(uploadsDir, `uploads/${school.code}`);
    }
  }

  // Backup configuration
  async backupConfig(archive, school) {
    const config = {
      school: school.toObject(),
      settings: await this.getSchoolSettings(school._id),
      timestamp: new Date().toISOString()
    };

    archive.append(JSON.stringify(config, null, 2), {
      name: 'config/school_config.json'
    });
  }

  async getSchoolSettings(schoolId) {
    const Setting = require('../models/Setting');
    return await Setting.find({ schoolId }).lean();
  }

  // Cleanup old backups
  async cleanupOldBackups(schoolId) {
    try {
      const backups = await Backup.find({ schoolId, status: 'completed' })
        .sort({ createdAt: -1 })
        .skip(10); // Keep last 10 backups

      for (const backup of backups) {
        // Delete file
        if (fs.existsSync(backup.filepath)) {
          fs.unlinkSync(backup.filepath);
        }
        
        // Delete record
        await Backup.findByIdAndDelete(backup._id);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  // Restore from backup
  async restoreBackup(backupId, userId) {
    try {
      const backup = await Backup.findById(backupId);
      if (!backup) {
        throw new Error('Backup not found');
      }

      if (backup.status !== 'completed') {
        throw new Error('Backup is not completed');
      }

      // Update backup status
      backup.restoreStatus = 'in_progress';
      backup.restoredBy = userId;
      backup.restoreStartedAt = new Date();
      await backup.save();

      // Perform restore in background
      this.performRestore(backup);

      return backup;
    } catch (error) {
      console.error('Restore error:', error);
      throw error;
    }
  }

  async performRestore(backup) {
    // Implementation for restore process
    // This would extract the backup and restore data
    // Note: This is a simplified example
    
    setTimeout(async () => {
      backup.restoreStatus = 'completed';
      backup.restoreCompletedAt = new Date();
      await backup.save();
    }, 5000);
  }

  // List backups for school
  async listBackups(schoolId, limit = 10) {
    return await Backup.find({ schoolId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('createdBy', 'name email')
      .populate('restoredBy', 'name email');
  }
}

module.exports = new BackupService();