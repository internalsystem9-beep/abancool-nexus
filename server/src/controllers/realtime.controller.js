const db = require("../config/db");
const { getErrorMessage } = require("../lib/errors");

// Map to store user socket connections
const userConnections = new Map();

// Map to store offline notifications queue
const offlineNotificationQueue = new Map();

// Map to store active rooms
const activeRooms = new Map();

// ==================== CONNECTION MANAGEMENT ====================

/**
 * Handle socket connection
 * @param {Object} socket - Socket.IO socket object
 * @param {Function} io - Socket.IO instance
 */
exports.handleSocketConnect = async (socket, io) => {
  const userId = socket.handshake.auth.userId;

  if (!userId) {
    socket.disconnect();
    return;
  }

  // Store connection
  if (!userConnections.has(userId)) {
    userConnections.set(userId, []);
  }
  userConnections.get(userId).push(socket.id);

  // Log connection
  await db.query(
    `INSERT INTO socket_connections (user_id, socket_id, connected_at, ip_address, user_agent)
     VALUES (?, ?, NOW(), ?, ?)`,
    [userId, socket.id, socket.handshake.address, socket.handshake.headers["user-agent"]]
  );

  // Broadcast user online status
  io.emit("user_online", {
    user_id: userId,
    timestamp: new Date(),
  });

  // Deliver queued notifications
  if (offlineNotificationQueue.has(userId)) {
    const notifications = offlineNotificationQueue.get(userId);
    notifications.forEach(notification => {
      socket.emit("notification", notification);
    });
    offlineNotificationQueue.delete(userId);
  }

  // Handle disconnect
  socket.on("disconnect", async () => {
    const connections = userConnections.get(userId) || [];
    const index = connections.indexOf(socket.id);
    if (index > -1) {
      connections.splice(index, 1);
    }

    if (connections.length === 0) {
      userConnections.delete(userId);
      io.emit("user_offline", {
        user_id: userId,
        timestamp: new Date(),
      });
    }

    // Log disconnection
    await db.query(
      `UPDATE socket_connections SET disconnected_at = NOW() WHERE socket_id = ?`,
      [socket.id]
    );
  });
};

// ==================== NOTIFICATIONS ====================

/**
 * Send notification to user(s)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} io - Socket.IO instance
 */
exports.sendNotification = async (req, res, io) => {
  try {
    const { recipient_user_ids, title, message, notification_type, data } = req.body;
    const senderId = req.user.id;

    if (!recipient_user_ids || recipient_user_ids.length === 0) {
      return res.status(400).json({ error: "At least one recipient is required" });
    }

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: "Notification title is required" });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: "Notification message is required" });
    }

    const validTypes = ["info", "warning", "error", "success", "alert"];
    if (!validTypes.includes(notification_type)) {
      return res.status(400).json({ error: `Invalid notification type. Valid types: ${validTypes.join(", ")}` });
    }

    const notification = {
      notification_id: Date.now(),
      sender_id: senderId,
      title,
      message,
      type: notification_type,
      data: data || {},
      created_at: new Date(),
      read: false,
    };

    let deliveredCount = 0;
    let queuedCount = 0;

    for (const recipientId of recipient_user_ids) {
      // Store notification in database
      await db.query(
        `INSERT INTO notifications (sender_id, recipient_id, title, message, notification_type, data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [senderId, recipientId, title, message, notification_type, JSON.stringify(data || {})]
      );

      // Send to connected sockets
      const connections = userConnections.get(recipientId);
      if (connections && connections.length > 0) {
        io.to(recipientId).emit("notification", notification);
        deliveredCount++;
      } else {
        // Queue for offline users
        if (!offlineNotificationQueue.has(recipientId)) {
          offlineNotificationQueue.set(recipientId, []);
        }
        offlineNotificationQueue.get(recipientId).push(notification);
        queuedCount++;
      }
    }

    res.status(201).json({
      success: true,
      data: {
        notification_id: notification.notification_id,
        delivered: deliveredCount,
        queued: queuedCount,
        total_recipients: recipient_user_ids.length,
      },
    });
  } catch (error) {
    console.error("Send notification error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Get user notifications
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, read } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE recipient_id = ?";
    const params = [userId];

    if (read !== undefined) {
      whereClause += " AND is_read = ?";
      params.push(read === "true" ? 1 : 0);
    }

    // Get total count
    const countResult = await db.query(`SELECT COUNT(*) as total FROM notifications ${whereClause}`, params);
    const total = countResult[0].total;

    // Get notifications
    const notifications = await db.query(
      `SELECT * FROM notifications ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Parse data
    const parsedNotifications = notifications.map(notif => ({
      ...notif,
      data: JSON.parse(notif.data || "{}"),
    }));

    res.json({
      success: true,
      data: parsedNotifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Mark notification as read
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} io - Socket.IO instance
 */
exports.markNotificationRead = async (req, res, io) => {
  try {
    const userId = req.user.id;
    const { notification_id } = req.params;

    // Get notification
    const notifResult = await db.query(`SELECT * FROM notifications WHERE id = ? AND recipient_id = ?`, [notification_id, userId]);

    if (notifResult.length === 0) {
      return res.status(404).json({ error: "Notification not found" });
    }

    // Update
    await db.query(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [notification_id]);

    // Broadcast update
    io.to(userId).emit("notification_read", {
      notification_id,
      user_id: userId,
    });

    res.json({
      success: true,
      data: {
        notification_id,
        read: true,
      },
    });
  } catch (error) {
    console.error("Mark notification read error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== LIVE CHAT/MESSAGING ====================

/**
 * Send chat message
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} io - Socket.IO instance
 */
exports.sendChatMessage = async (req, res, io) => {
  try {
    const { recipient_id, message, message_type } = req.body;
    const senderId = req.user.id;

    if (!recipient_id) {
      return res.status(400).json({ error: "Recipient ID is required" });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (message.length > 5000) {
      return res.status(400).json({ error: "Message exceeds 5000 characters" });
    }

    const msgType = message_type || "text";
    const validTypes = ["text", "image", "file", "attachment"];
    if (!validTypes.includes(msgType)) {
      return res.status(400).json({ error: `Invalid message type. Valid types: ${validTypes.join(", ")}` });
    }

    // Store message
    const result = await db.query(
      `INSERT INTO chat_messages (sender_id, recipient_id, message, message_type, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [senderId, recipient_id, message, msgType]
    );

    const messageData = {
      message_id: result.insertId,
      sender_id: senderId,
      recipient_id,
      message,
      message_type: msgType,
      created_at: new Date(),
      read: false,
    };

    // Send to recipient
    const connections = userConnections.get(recipient_id);
    if (connections && connections.length > 0) {
      io.to(recipient_id).emit("chat_message", messageData);
    }

    res.status(201).json({
      success: true,
      data: messageData,
    });
  } catch (error) {
    console.error("Send chat message error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Get chat history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getChatHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { peer_id, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    if (!peer_id) {
      return res.status(400).json({ error: "Peer ID is required" });
    }

    // Get messages between two users
    const messages = await db.query(
      `SELECT * FROM chat_messages 
       WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [userId, peer_id, peer_id, userId, limit, offset]
    );

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM chat_messages 
       WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)`,
      [userId, peer_id, peer_id, userId]
    );

    res.json({
      success: true,
      data: messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit),
      },
    });
  } catch (error) {
    console.error("Get chat history error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Mark chat message as read
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} io - Socket.IO instance
 */
exports.markChatMessageRead = async (req, res, io) => {
  try {
    const userId = req.user.id;
    const { message_id } = req.params;

    // Get message
    const msgResult = await db.query(`SELECT * FROM chat_messages WHERE id = ? AND recipient_id = ?`, [message_id, userId]);

    if (msgResult.length === 0) {
      return res.status(404).json({ error: "Message not found" });
    }

    const message = msgResult[0];

    // Update
    await db.query(`UPDATE chat_messages SET is_read = 1 WHERE id = ?`, [message_id]);

    // Broadcast update
    io.to(message.sender_id).emit("message_read", {
      message_id,
      reader_id: userId,
    });

    res.json({
      success: true,
      data: {
        message_id,
        read: true,
      },
    });
  } catch (error) {
    console.error("Mark message read error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== PRESENCE TRACKING ====================

/**
 * Get online users
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getOnlineUsers = async (req, res) => {
  try {
    const onlineUsers = Array.from(userConnections.keys()).map(userId => ({
      user_id: userId,
      connection_count: userConnections.get(userId).length,
    }));

    res.json({
      success: true,
      data: {
        online_users: onlineUsers,
        total_online: onlineUsers.length,
      },
    });
  } catch (error) {
    console.error("Get online users error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Check if user is online
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.checkUserOnline = async (req, res) => {
  try {
    const { user_id } = req.params;

    const isOnline = userConnections.has(user_id);
    const connectionCount = isOnline ? userConnections.get(user_id).length : 0;

    res.json({
      success: true,
      data: {
        user_id,
        is_online: isOnline,
        connection_count: connectionCount,
      },
    });
  } catch (error) {
    console.error("Check user online error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== ROOM MANAGEMENT ====================

/**
 * Join room
 * @param {Object} socket - Socket.IO socket object
 * @param {Object} io - Socket.IO instance
 * @param {string} roomId - Room identifier
 * @param {number} userId - User ID
 */
exports.joinRoom = async (socket, io, roomId, userId) => {
  socket.join(roomId);

  if (!activeRooms.has(roomId)) {
    activeRooms.set(roomId, new Set());
  }
  activeRooms.get(roomId).add(userId);

  // Log room join
  await db.query(
    `INSERT INTO room_activity (room_id, user_id, action, created_at)
     VALUES (?, ?, 'joined', NOW())`,
    [roomId, userId]
  );

  io.to(roomId).emit("user_joined_room", {
    room_id: roomId,
    user_id: userId,
    timestamp: new Date(),
  });
};

/**
 * Leave room
 * @param {Object} socket - Socket.IO socket object
 * @param {Object} io - Socket.IO instance
 * @param {string} roomId - Room identifier
 * @param {number} userId - User ID
 */
exports.leaveRoom = async (socket, io, roomId, userId) => {
  socket.leave(roomId);

  const room = activeRooms.get(roomId);
  if (room) {
    room.delete(userId);
    if (room.size === 0) {
      activeRooms.delete(roomId);
    }
  }

  // Log room leave
  await db.query(
    `INSERT INTO room_activity (room_id, user_id, action, created_at)
     VALUES (?, ?, 'left', NOW())`,
    [roomId, userId]
  );

  io.to(roomId).emit("user_left_room", {
    room_id: roomId,
    user_id: userId,
    timestamp: new Date(),
  });
};

/**
 * Get room members
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getRoomMembers = async (req, res) => {
  try {
    const { room_id } = req.params;

    const room = activeRooms.get(room_id);
    const members = room ? Array.from(room) : [];

    res.json({
      success: true,
      data: {
        room_id,
        members,
        member_count: members.length,
      },
    });
  } catch (error) {
    console.error("Get room members error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Broadcast to room
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} io - Socket.IO instance
 */
exports.broadcastToRoom = async (req, res, io) => {
  try {
    const { room_id, event_type, message, data } = req.body;
    const userId = req.user.id;

    if (!room_id) {
      return res.status(400).json({ error: "Room ID is required" });
    }

    if (!event_type) {
      return res.status(400).json({ error: "Event type is required" });
    }

    // Log broadcast
    await db.query(
      `INSERT INTO room_activity (room_id, user_id, action, metadata, created_at)
       VALUES (?, ?, 'broadcast', ?, NOW())`,
      [room_id, userId, JSON.stringify({ event_type, message })]
    );

    // Send broadcast
    io.to(room_id).emit("room_broadcast", {
      room_id,
      event_type,
      message,
      data: data || {},
      sender_id: userId,
      timestamp: new Date(),
    });

    res.status(201).json({
      success: true,
      data: {
        room_id,
        event_type,
        recipients: activeRooms.get(room_id)?.size || 0,
      },
    });
  } catch (error) {
    console.error("Broadcast to room error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== ACTIVITY FEED ====================

/**
 * Log activity
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} io - Socket.IO instance
 */
exports.logActivity = async (req, res, io) => {
  try {
    const { activity_type, activity_title, activity_description, related_user_ids } = req.body;
    const userId = req.user.id;

    if (!activity_type) {
      return res.status(400).json({ error: "Activity type is required" });
    }

    // Store activity
    const result = await db.query(
      `INSERT INTO activity_logs (user_id, activity_type, title, description, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [userId, activity_type, activity_title, activity_description]
    );

    const activity = {
      activity_id: result.insertId,
      user_id: userId,
      activity_type,
      title: activity_title,
      description: activity_description,
      created_at: new Date(),
    };

    // Broadcast to related users
    if (related_user_ids && related_user_ids.length > 0) {
      for (const relatedUserId of related_user_ids) {
        io.to(relatedUserId).emit("activity_update", activity);
      }
    }

    // Broadcast to all connected users (optional)
    io.emit("activity_update", activity);

    res.status(201).json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error("Log activity error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Get activity feed
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getActivityFeed = async (req, res) => {
  try {
    const { page = 1, limit = 30, activity_type } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE 1=1";
    const params = [];

    if (activity_type) {
      whereClause += " AND activity_type = ?";
      params.push(activity_type);
    }

    // Get total count
    const countResult = await db.query(`SELECT COUNT(*) as total FROM activity_logs ${whereClause}`, params);
    const total = countResult[0].total;

    // Get activities
    const activities = await db.query(
      `SELECT * FROM activity_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: activities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get activity feed error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== REAL-TIME ALERTS ====================

/**
 * Send alert
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} io - Socket.IO instance
 */
exports.sendAlert = async (req, res, io) => {
  try {
    const { alert_type, alert_level, title, message, target_users } = req.body;
    const userId = req.user.id;

    const validLevels = ["low", "medium", "high", "critical"];
    if (!validLevels.includes(alert_level)) {
      return res.status(400).json({ error: `Invalid alert level. Valid levels: ${validLevels.join(", ")}` });
    }

    // Store alert
    const result = await db.query(
      `INSERT INTO alerts (created_by, alert_type, alert_level, title, message, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [userId, alert_type, alert_level, title, message]
    );

    const alert = {
      alert_id: result.insertId,
      created_by: userId,
      alert_type,
      alert_level,
      title,
      message,
      created_at: new Date(),
    };

    // Send to target users or broadcast
    if (target_users && target_users.length > 0) {
      for (const targetUserId of target_users) {
        io.to(targetUserId).emit("alert", alert);
      }
    } else {
      io.emit("alert", alert);
    }

    res.status(201).json({
      success: true,
      data: alert,
    });
  } catch (error) {
    console.error("Send alert error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== CONNECTION STATISTICS ====================

/**
 * Get connection statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getConnectionStats = async (req, res) => {
  try {
    // Active connections
    const activeConnections = Array.from(userConnections.values()).reduce((sum, connections) => sum + connections.length, 0);
    const activeUsers = userConnections.size;

    // Get database stats
    const dbStats = await db.query(`
      SELECT 
        COUNT(*) as total_connections,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(CASE WHEN disconnected_at IS NULL THEN 1 END) as active_connections
      FROM socket_connections
    `);

    // Room stats
    const roomStats = {
      total_rooms: activeRooms.size,
      total_members: Array.from(activeRooms.values()).reduce((sum, members) => sum + members.size, 0),
    };

    res.json({
      success: true,
      data: {
        current_active_connections: activeConnections,
        current_active_users: activeUsers,
        database_stats: dbStats[0],
        room_stats: roomStats,
      },
    });
  } catch (error) {
    console.error("Get connection stats error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

module.exports = exports;
