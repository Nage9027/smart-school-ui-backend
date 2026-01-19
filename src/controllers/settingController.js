const Setting = require('../models/Setting');
const School = require('../models/School');
const AcademicYear = require('../models/AcademicYear');
const NotificationSetting = require('../models/NotificationSetting');
const SecuritySetting = require('../models/SecuritySetting');
const BillingPlan = require('../models/BillingPlan');
const SystemHealth = require('../models/SystemHealth');
const { validationResult } = require('express-validator');
const { createBackup } = require('../services/backupService');
const { checkSystemHealth } = require('../services/healthCheckService');

// @desc    Get all settings grouped by category
// @route   GET /api/settings
// @access  Private (Admin)
exports.getAllSettings = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    
    // Get settings grouped
    const settings = await Setting.findGrouped(schoolId);
    
    // Get school info
    const school = await School.findById(schoolId).select('-metadata');
    
    // Get academic year
    const academicYear = await AcademicYear.getCurrent(schoolId);
    
    // Get notification settings
    const notificationSettings = await NotificationSetting.find({ schoolId });
    
    // Get security settings
    const securitySettings = await SecuritySetting.findBySchool(schoolId);
    
    // Get billing plan
    const billingPlan = await BillingPlan.findBySchool(schoolId);
    
    // Get system health
    const systemHealth = await SystemHealth.getLatest(schoolId);
    
    res.status(200).json({
      success: true,
      data: {
        school: school || {},
        academic: academicYear || {},
        notifications: notificationSettings || [],
        security: securitySettings || {},
        billing: billingPlan || {},
        systemHealth: systemHealth || {},
        settings
      }
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get specific setting category
// @route   GET /api/settings/:category
// @access  Private (Admin)
exports.getSettingsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const schoolId = req.user.schoolId;
    
    const validCategories = ['school', 'academic', 'notifications', 'security', 'billing', 'advanced'];
    
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      });
    }
    
    let data;
    
    switch (category) {
      case 'school':
        data = await School.findById(schoolId);
        break;
      case 'academic':
        data = await AcademicYear.getCurrent(schoolId);
        break;
      case 'notifications':
        data = await NotificationSetting.find({ schoolId });
        break;
      case 'security':
        data = await SecuritySetting.findBySchool(schoolId);
        break;
      case 'billing':
        data = await BillingPlan.findBySchool(schoolId);
        break;
      case 'advanced':
        data = await Setting.find({ schoolId, group: 'advanced' });
        break;
    }
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Get category settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update school profile
// @route   PUT /api/settings/school
// @access  Private (Admin)
exports.updateSchoolProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const schoolId = req.user.schoolId;
    const updateData = req.body;
    
    // Handle logo upload
    if (req.file) {
      updateData.logo = {
        url: req.file.path,
        publicId: req.file.filename,
        thumbnailUrl: `${req.file.path}-thumbnail`
      };
    }
    
    // Update school
    const school = await School.findByIdAndUpdate(
      schoolId,
      { $set: updateData, 'metadata.lastUpdated': new Date() },
      { new: true, runValidators: true }
    );
    
    // Create audit log
    await createAuditLog(req.user, 'school_profile_update', {
      schoolId,
      changes: updateData,
      ip: req.ip
    });
    
    res.status(200).json({
      success: true,
      message: 'School profile updated successfully',
      data: school
    });
  } catch (error) {
    console.error('Update school profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update academic settings
// @route   PUT /api/settings/academic
// @access  Private (Admin)
exports.updateAcademicSettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const schoolId = req.user.schoolId;
    const academicData = req.body;
    
    // Check if academic year exists
    let academicYear = await AcademicYear.findOne({
      schoolId,
      year: academicData.year
    });
    
    if (academicYear) {
      // Update existing
      academicYear = await AcademicYear.findByIdAndUpdate(
        academicYear._id,
        { $set: academicData },
        { new: true, runValidators: true }
      );
    } else {
      // Create new
      academicYear = await AcademicYear.create({
        schoolId,
        ...academicData
      });
    }
    
    // Create audit log
    await createAuditLog(req.user, 'academic_settings_update', {
      schoolId,
      academicYearId: academicYear._id,
      changes: academicData,
      ip: req.ip
    });
    
    res.status(200).json({
      success: true,
      message: 'Academic settings updated successfully',
      data: academicYear
    });
  } catch (error) {
    console.error('Update academic settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update notification settings
// @route   PUT /api/settings/notifications
// @access  Private (Admin)
exports.updateNotificationSettings = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { notifications } = req.body;
    
    // Update each notification
    const updatePromises = notifications.map(async (notification) => {
      return NotificationSetting.findOneAndUpdate(
        { schoolId, type: notification.type },
        { $set: notification },
        { upsert: true, new: true }
      );
    });
    
    await Promise.all(updatePromises);
    
    // Create audit log
    await createAuditLog(req.user, 'notification_settings_update', {
      schoolId,
      notifications: notifications.map(n => ({ type: n.type, enabled: n.isEnabled })),
      ip: req.ip
    });
    
    res.status(200).json({
      success: true,
      message: 'Notification settings updated successfully'
    });
  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update security settings
// @route   PUT /api/settings/security
// @access  Private (Admin)
exports.updateSecuritySettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const schoolId = req.user.schoolId;
    const securityData = req.body;
    
    // Check if security settings exist
    let securitySettings = await SecuritySetting.findOne({ schoolId });
    
    // Handle API key regeneration
    if (securityData.regenerateApiKey) {
      securityData.apiSecurity = securityData.apiSecurity || {};
      securityData.apiSecurity.apiKey = crypto.randomBytes(32).toString('hex');
    }
    
    if (securitySettings) {
      // Update existing
      securitySettings = await SecuritySetting.findByIdAndUpdate(
        securitySettings._id,
        { $set: securityData },
        { new: true, runValidators: true }
      );
    } else {
      // Create new
      securitySettings = await SecuritySetting.create({
        schoolId,
        ...securityData
      });
    }
    
    // Create audit log (sensitive data removed)
    const auditData = { ...securityData };
    delete auditData.apiKey;
    delete auditData.webhookSecret;
    
    await createAuditLog(req.user, 'security_settings_update', {
      schoolId,
      changes: auditData,
      ip: req.ip
    });
    
    res.status(200).json({
      success: true,
      message: 'Security settings updated successfully',
      data: securitySettings
    });
  } catch (error) {
    console.error('Update security settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update billing settings
// @route   PUT /api/settings/billing
// @access  Private (Admin)
exports.updateBillingSettings = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const billingData = req.body;
    
    // Check if billing plan exists
    let billingPlan = await BillingPlan.findOne({ schoolId });
    
    if (billingPlan) {
      // Update existing
      billingPlan = await BillingPlan.findByIdAndUpdate(
        billingPlan._id,
        { $set: billingData },
        { new: true, runValidators: true }
      );
    } else {
      // Create new
      billingPlan = await BillingPlan.create({
        schoolId,
        ...billingData
      });
    }
    
    // Create audit log
    await createAuditLog(req.user, 'billing_settings_update', {
      schoolId,
      plan: billingPlan.currentPlan.name,
      changes: billingData,
      ip: req.ip
    });
    
    res.status(200).json({
      success: true,
      message: 'Billing settings updated successfully',
      data: billingPlan
    });
  } catch (error) {
    console.error('Update billing settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update advanced settings
// @route   PUT /api/settings/advanced
// @access  Private (Admin)
exports.updateAdvancedSettings = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const advancedData = req.body;
    
    // Update or create settings
    const updatePromises = Object.keys(advancedData).map(async (key) => {
      return Setting.findOneAndUpdate(
        { schoolId, key, group: 'advanced' },
        {
          $set: {
            value: advancedData[key],
            lastModifiedBy: req.user._id,
            type: 'advanced',
            category: 'system'
          }
        },
        { upsert: true, new: true }
      );
    });
    
    await Promise.all(updatePromises);
    
    // Create audit log
    await createAuditLog(req.user, 'advanced_settings_update', {
      schoolId,
      changes: advancedData,
      ip: req.ip
    });
    
    res.status(200).json({
      success: true,
      message: 'Advanced settings updated successfully'
    });
  } catch (error) {
    console.error('Update advanced settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Create system backup
// @route   POST /api/settings/backup
// @access  Private (Admin)
exports.createBackup = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { type, description } = req.body;
    
    // Create backup
    const backup = await createBackup(schoolId, type, req.user._id, description);
    
    // Create audit log
    await createAuditLog(req.user, 'system_backup_created', {
      schoolId,
      backupId: backup._id,
      type,
      description,
      ip: req.ip
    });
    
    res.status(201).json({
      success: true,
      message: 'Backup created successfully',
      data: backup
    });
  } catch (error) {
    console.error('Create backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Backup creation failed',
      error: error.message
    });
  }
};

// @desc    Export data
// @route   POST /api/settings/export
// @access  Private (Admin)
exports.exportData = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { format, dataTypes } = req.body;
    
    // Validate format
    const validFormats = ['csv', 'excel', 'json', 'pdf'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid export format'
      });
    }
    
    // Generate export
    const exportData = await generateExport(schoolId, format, dataTypes);
    
    // Create audit log
    await createAuditLog(req.user, 'data_export', {
      schoolId,
      format,
      dataTypes,
      ip: req.ip
    });
    
    res.status(200).json({
      success: true,
      message: 'Export completed successfully',
      data: {
        downloadUrl: exportData.url,
        expiresAt: exportData.expiresAt,
        size: exportData.size
      }
    });
  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({
      success: false,
      message: 'Export failed',
      error: error.message
    });
  }
};

// @desc    Get system health
// @route   GET /api/settings/health
// @access  Private (Admin)
exports.getSystemHealth = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    
    // Get current health
    const health = await checkSystemHealth(schoolId);
    
    // Get history (last 24 hours)
    const history = await SystemHealth.getHistory(schoolId, 24);
    
    res.status(200).json({
      success: true,
      data: {
        current: health,
        history,
        summary: {
          status: health.isHealthy() ? 'healthy' : 'degraded',
          score: health.healthScore,
          recommendations: health.recommendations || []
        }
      }
    });
  } catch (error) {
    console.error('Get system health error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get system health',
      error: error.message
    });
  }
};

// @desc    Reset settings to default
// @route   POST /api/settings/reset
// @access  Private (Super Admin)
exports.resetSettings = async (req, res) => {
  try {
    const { category, schoolId } = req.body;
    
    // Only super admin can reset settings
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    
    // Reset based on category
    let result;
    switch (category) {
      case 'all':
        // Reset all settings (dangerous!)
        await Setting.deleteMany({ schoolId });
        await createDefaultSettings(schoolId);
        break;
      case 'notifications':
        await NotificationSetting.deleteMany({ schoolId });
        await createDefaultNotificationSettings(schoolId);
        break;
      case 'security':
        await SecuritySetting.deleteMany({ schoolId });
        await createDefaultSecuritySettings(schoolId);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid category'
        });
    }
    
    // Create audit log
    await createAuditLog(req.user, 'settings_reset', {
      schoolId,
      category,
      resetBy: req.user._id,
      ip: req.ip
    });
    
    res.status(200).json({
      success: true,
      message: 'Settings reset successfully'
    });
  } catch (error) {
    console.error('Reset settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Reset failed',
      error: error.message
    });
  }
};

// Helper function to create audit log
async function createAuditLog(user, action, details) {
  const AuditLog = require('../models/AuditLog');
  
  await AuditLog.create({
    userId: user._id,
    schoolId: user.schoolId,
    action,
    details,
    ip: details.ip,
    timestamp: new Date()
  });
}

// Helper function to generate export
async function generateExport(schoolId, format, dataTypes) {
  // Implementation for data export
  // This would generate files and return download URLs
  return {
    url: `/exports/${schoolId}/${Date.now()}.${format}`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    size: 1024 * 1024 // 1MB example
  };
}

// Helper function to create default settings
async function createDefaultSettings(schoolId) {
  const defaultSettings = [
    // School settings
    { schoolId, type: 'school', category: 'profile', key: 'timezone', value: 'Asia/Kolkata', group: 'general' },
    { schoolId, type: 'school', category: 'profile', key: 'dateFormat', value: 'DD/MM/YYYY', group: 'general' },
    { schoolId, type: 'school', category: 'profile', key: 'currency', value: 'INR', group: 'general' },
    
    // System settings
    { schoolId, type: 'advanced', category: 'system', key: 'maintenanceMode', value: false, group: 'advanced' },
    { schoolId, type: 'advanced', category: 'system', key: 'errorReporting', value: true, group: 'advanced' },
    { schoolId, type: 'advanced', category: 'system', key: 'analyticsTracking', value: true, group: 'advanced' },
  ];
  
  await Setting.insertMany(defaultSettings);
}