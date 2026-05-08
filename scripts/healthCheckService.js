const os = require('os');
const mongoose = require('mongoose');
const SystemHealth = require('../models/SystemHealth');

class HealthCheckService {
  constructor() {
    this.checkInterval = process.env.HEALTH_CHECK_INTERVAL || 300000; // 5 minutes
    this.startPeriodicChecks();
  }

  // Start periodic health checks
  startPeriodicChecks() {
    setInterval(() => {
      this.checkAllSchools();
    }, this.checkInterval);
  }

  // Check all active schools
  async checkAllSchools() {
    try {
      const School = require('../models/School');
      const activeSchools = await School.find({ status: 'active' }).select('_id');
      
      for (const school of activeSchools) {
        await this.checkSchoolHealth(school._id);
      }
    } catch (error) {
      console.error('Health check error:', error);
    }
  }

  // Check health for a specific school
  async checkSchoolHealth(schoolId) {
    try {
      const healthData = {
        schoolId,
        timestamp: new Date(),
        uptime: await this.getUptime(),
        responseTime: await this.getResponseTime(),
        resources: await this.getResourceUsage(),
        database: await this.getDatabaseStats(),
        services: await this.getServiceStatus(),
        users: await this.getUserStats(schoolId),
        errors: await this.getRecentErrors(schoolId),
        metrics: await this.getSystemMetrics(schoolId),
        recommendations: await this.generateRecommendations(schoolId)
      };

      // Create health record
      const healthRecord = new SystemHealth(healthData);
      await healthRecord.save();

      // Check for critical issues and send alerts
      await this.checkForAlerts(healthRecord, schoolId);

      return healthRecord;
    } catch (error) {
      console.error(`Health check failed for school ${schoolId}:`, error);
    }
  }

  async getUptime() {
    // Calculate uptime percentage (simplified)
    return 99.95; // Mock value
  }

  async getResponseTime() {
    // Get average API response time
    const responseTimes = [100, 150, 200, 120, 180]; // Mock data
    const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    
    return {
      average: Math.round(avg),
      p95: 200,
      p99: 220,
      max: 250
    };
  }

  async getResourceUsage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
      cpu: {
        usage: os.loadavg()[0] * 100, // 1-minute load average
        cores: os.cpus().length,
        load: os.loadavg()
      },
      memory: {
        total: Math.round(totalMemory / 1024 / 1024 / 1024 * 100) / 100, // GB
        used: Math.round(usedMemory / 1024 / 1024 / 1024 * 100) / 100,
        free: Math.round(freeMemory / 1024 / 1024 / 1024 * 100) / 100,
        usage: Math.round((usedMemory / totalMemory) * 100)
      },
      storage: {
        total: 500, // GB - Mock value
        used: 225, // GB - Mock value
        free: 275, // GB - Mock value
        usage: 45 // Percentage
      },
      network: {
        inbound: 100, // Mbps - Mock value
        outbound: 50, // Mbps - Mock value
        connections: 150 // Mock value
      }
    };
  }

  async getDatabaseStats() {
    try {
      const db = mongoose.connection.db;
      const admin = db.admin();
      
      const serverStatus = await admin.serverStatus();
      const dbStats = await db.stats();
      
      return {
        connections: {
          active: serverStatus.connections.current,
          idle: serverStatus.connections.available,
          total: serverStatus.connections.totalCreated
        },
        queries: {
          perSecond: serverStatus.opcounters.query,
          slowQueries: 0, // Would come from slow query log
          avgQueryTime: 0 // Would be calculated from query logs
        },
        size: {
          total: Math.round(dbStats.dataSize / 1024 / 1024), // MB
          data: Math.round(dbStats.storageSize / 1024 / 1024), // MB
          index: Math.round(dbStats.indexSize / 1024 / 1024) // MB
        }
      };
    } catch (error) {
      console.error('Database stats error:', error);
      return {
        connections: { active: 0, idle: 0, total: 0 },
        queries: { perSecond: 0, slowQueries: 0, avgQueryTime: 0 },
        size: { total: 0, data: 0, index: 0 }
      };
    }
  }

  async getServiceStatus() {
    // Check various services
    const services = [
      { name: 'API Server', status: 'up', responseTime: 120, version: '1.0.0' },
      { name: 'Database', status: 'up', responseTime: 45, version: '5.0.0' },
      { name: 'Cache', status: 'up', responseTime: 5, version: '6.0.0' },
      { name: 'File Storage', status: 'up', responseTime: 80, version: '1.0.0' },
      { name: 'Email Service', status: 'up', responseTime: 200, version: '1.0.0' }
    ];

    return services;
  }

  async getUserStats(schoolId) {
    const User = require('../models/User');
    
    const totalUsers = await User.countDocuments({ schoolId });
    const activeUsers = await User.countDocuments({ 
      schoolId, 
      lastActive: { $gte: new Date(Date.now() - 15 * 60 * 1000) } // Last 15 minutes
    });
    
    // Mock concurrent users (would come from session store)
    const concurrentUsers = Math.floor(activeUsers * 0.7);
    
    // Mock new users today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const newToday = await User.countDocuments({
      schoolId,
      createdAt: { $gte: startOfDay }
    });

    return {
      active: activeUsers,
      total: totalUsers,
      concurrent: concurrentUsers,
      newToday: newToday
    };
  }

  async getRecentErrors(schoolId) {
    const ErrorLog = require('../models/ErrorLog');
    
    const errors = await ErrorLog.find({
      schoolId,
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).limit(10);

    return errors.map(error => ({
      type: error.type,
      message: error.message,
      count: error.count,
      firstOccurred: error.firstOccurred,
      lastOccurred: error.lastOccurred
    }));
  }

  async getSystemMetrics(schoolId) {
    // Get system metrics (simplified)
    return {
      requests: {
        total: 10000,
        successful: 9800,
        failed: 200,
        perSecond: 5
      },
      cache: {
        hitRate: 85,
        size: 256,
        evictions: 10
      },
      queue: {
        length: 0,
        processing: 5,
        waiting: 0
      }
    };
  }

  async generateRecommendations(schoolId) {
    const recommendations = [];
    
    // Example recommendations based on system state
    const health = await SystemHealth.getLatest(schoolId);
    
    if (health) {
      if (health.resources.storage.usage > 80) {
        recommendations.push({
          type: 'storage',
          priority: 'high',
          message: 'Storage usage is high. Consider cleaning up old data or upgrading storage.',
          action: 'Review and clean up old files',
          estimatedImpact: 'High'
        });
      }
      
      if (health.responseTime.average > 500) {
        recommendations.push({
          type: 'performance',
          priority: 'medium',
          message: 'Average response time is above optimal levels.',
          action: 'Optimize database queries and add caching',
          estimatedImpact: 'Medium'
        });
      }
      
      if (health.uptime < 99.5) {
        recommendations.push({
          type: 'reliability',
          priority: 'critical',
          message: 'System uptime is below acceptable levels.',
          action: 'Check server logs and increase monitoring',
          estimatedImpact: 'Critical'
        });
      }
    }
    
    return recommendations;
  }

  async checkForAlerts(healthRecord, schoolId) {
    const NotificationService = require('./notificationService');
    
    // Check for critical conditions
    if (healthRecord.uptime < 99) {
      await NotificationService.sendAlert({
        schoolId,
        type: 'system_downtime',
        priority: 'critical',
        message: `System uptime dropped to ${healthRecord.uptime}%`,
        data: healthRecord
      });
    }
    
    if (healthRecord.resources.storage.usage > 90) {
      await NotificationService.sendAlert({
        schoolId,
        type: 'storage_critical',
        priority: 'high',
        message: `Storage usage is critical: ${healthRecord.resources.storage.usage}%`,
        data: healthRecord
      });
    }
    
    if (healthRecord.resources.memory.usage > 90) {
      await NotificationService.sendAlert({
        schoolId,
        type: 'memory_critical',
        priority: 'high',
        message: `Memory usage is critical: ${healthRecord.resources.memory.usage}%`,
        data: healthRecord
      });
    }
  }
}

module.exports = new HealthCheckService();