package sqlGather

import (
	"LanDrop/client/db"
	"database/sql"
	"fmt"
	"log"
)

type SqlGather struct {
	DB     db.SqlliteDB
	SqlMap map[string]string
}

var SqlMap = map[string]string{
	// 查询消息数据
	"queryNotifyData": `SELECT 
		f.*,
		u_from.id AS fromId,
		u_from.name AS fromName,
		u_from.nickName AS fromNickName,
		u_from.role AS fromRole,
		u_from.ip AS fromIp,
		u_to.id AS toId,
		u_to.name AS toName,
		u_to.nickName AS toNickName,
		u_to.role AS toRole,
		u_to.ip AS toIp
	FROM 
		friendships f
	LEFT JOIN 
		users u_from ON f.userId = u_from.id
	INNER JOIN
		users u_to ON f.friendId = u_to.id
	WHERE 
		f.status = 'pending' 
		AND f.friendId = ?`,
	// 查询客户端列表
	"queryClients": `SELECT * FROM users
	WHERE id != ? AND id > 999
	AND NOT EXISTS (
		SELECT 1 FROM friendships
		WHERE userId = ? AND friendId = users.id AND status != 'reject'
	)`,
	// 插入好友申请记录
	"execInsertFriendshipsRecord": `INSERT INTO friendships ( "userId", "friendId", "status", "createTime" )
	VALUES
		( ?, ?, 'pending', ? )`,
	// 查询插入好友申请记录数据
	"queryInsertFriendshipsRecord": `SELECT 
		f.*,
		u_from.id AS fromId,
		u_from.name AS fromName,
		u_from.nickName AS fromNickName,
		u_from.role AS fromRole,
		u_from.ip AS fromIp,
		u_to.id AS toId,
		u_to.name AS toName,
		u_to.nickName AS toNickName,
		u_to.role AS toRole,
		u_to.ip AS toIp
	FROM 
		friendships f
	LEFT JOIN 
		users u_from ON f.userId = u_from.id
	INNER JOIN
		users u_to ON f.friendId = u_to.id
	WHERE 
		f.status = 'pending' AND f.fId = ?`,
	// 查询好友记录
	"queryFriendshipsRecord": `SELECT
		* 
	FROM
		friendships 
	WHERE
		fId = ? AND friendId = ?`,
	// 插入好友同意数据，好友双向绑定
	"execInsertFriendshipsAcceptRecord": `INSERT INTO friendships ( "userId", "friendId", "status", "createTime" )
	VALUES
		( ?, ?, ?, ? )`,
	// 更新好友关系状态
	"execUpdateFriendshipsStatus": `UPDATE friendships 
	SET status = ? 
	WHERE
		fId = ?`,
	// 查询好友列表以及聊天记录信息
	"queryFriendListAndchatRecord": `SELECT 
		f.*,
		u.id AS friendId,
		u.name AS friendName,
		u.nickName AS friendNickName,
		u.avatar AS friendAvatar,
		u.role AS friendRole,
		u.ip AS friendIp,
		c.type AS msgType,
		c.message AS lastMsg,
		c.time AS msgTime,
		(
			SELECT COUNT(*) 
			FROM chat_records cr 
			WHERE cr.fromId = f.friendId 
			AND cr.toId = f.userId 
			AND cr.isRead = 'n'
		) AS unreadCount
	FROM 
		friendships f
	INNER JOIN 
		users u ON f.friendId = u.id
	LEFT JOIN 
		chat_records c ON (
			c.cId = f.lastChatId 
			AND (c.fromId = f.friendId OR c.toId = f.friendId)
		)
	WHERE 
		f.status = 'accept' 
		AND f.userId = ?`,
	// 查询好友的聊天记录
	"queryFriendChatRecord": `SELECT
		c.*,
		u_from.name AS fromName,
		u_from.nickName AS fromNickName,
		u_to.name AS toName, 
		u_to.nickName AS toNickName 
	FROM
		chat_records c
		JOIN users u_from ON c.fromId = u_from.id
		JOIN users u_to ON c.toId = u_to.id 
	WHERE
		(
			( c.fromId = ? AND c.toId = ? ) 
			OR ( c.fromId = ? AND c.toId = ? ) 
		) 
		AND (
			c.time >= (
			SELECT
				COALESCE(
					(
					SELECT
						time 
					FROM
						chat_records 
					WHERE
						( fromId = ? AND toId = ? ) 
						OR ( fromId = ? AND toId = ? ) 
					ORDER BY
						time DESC 
						LIMIT 1 OFFSET 499 
					),
					0 
				) 
			) 
			OR c.time >= strftime( '%s', datetime( 'now', '-7 days' ) ) 
		) 
	ORDER BY
		c.time ASC 
		LIMIT 500`,
	// 修改聊天记录阅读状态（多条）
	"execUpdateChatRecordsReadStatus": `UPDATE chat_records SET isRead = 'y' WHERE fromId = ? AND toId = ?`,
	// 修改聊天记录阅读状态（1条）
	"execUpdateChatRecordReadStatus": `UPDATE chat_records SET isRead = 'y' WHERE cId = ?`,
	// 查询两者是否好友关系
	"queryIsFriend": `SELECT
		* 
	FROM
		friendships 
	WHERE
		userId = ? 
		AND friendId = ?`,
	// 插入新的聊天记录
	"execInsertNewChatRecord": `INSERT INTO chat_records ( "toId", "fromId", "message", "isRead", "time" )
	VALUES
		( ?, ?, ?, ?, ? )`,
	// 更新好友记录中的最后一条聊天id
	"execUpdateFriendshipsLastChatId": `UPDATE friendships 
	SET lastChatId = ? 
	WHERE
		( userId = ? AND friendId = ? ) 
		OR ( userId = ? AND friendId = ? )`,
	// 查询插入的聊天数据
	"queryInsertChatRecord": `SELECT 
		c.*,
		u_from.name AS fromName,
		u_from.nickName AS fromNickName,
		u_to.name AS toName,
		u_to.nickName AS toNickName
	FROM 
		chat_records c
	LEFT JOIN 
		users u_from ON c.fromId = u_from.id
	INNER JOIN
		users u_to ON c.toId = u_to.id
	WHERE c.cId = ?`,
	// 查询好友的好友列表以及聊天记录信息
	"queryFriendListAndchatRecordFromFriend": `SELECT 
		f.*,
		u.id AS friendId,
		u.name AS friendName,
		u.nickName AS friendNickName,
		u.avatar AS friendAvatar,
		u.role AS friendRole,
		u.ip AS friendIp,
		c.type AS msgType,
		c.message AS lastMsg,
		c.time AS msgTime,
		(
			SELECT COUNT(*) 
			FROM chat_records cr 
			WHERE cr.fromId = f.friendId 
			AND cr.toId = f.userId 
			AND cr.isRead = 'n'
		) AS unreadCount
	FROM 
		friendships f
	INNER JOIN 
		users u ON f.friendId = u.id
	LEFT JOIN 
		chat_records c ON (
			c.cId = f.lastChatId 
			AND (c.fromId = f.friendId OR c.toId = f.friendId)
		)
	WHERE 
		f.status = 'accept' 
		AND f.friendId = ?`,
}

func (sg *SqlGather) RunQuery(runType string, args ...any) []map[string]any {
	results := []map[string]any{}
	if query, ok := SqlMap[runType]; ok {
		results = sg.DB.QueryList(query, args...)
	} else {
		log.Println("不存在RunQuery类型")
	}
	return results
}

func (sg *SqlGather) RunExec(runType string, args ...any) (sql.Result, error) {
	if query, ok := SqlMap[runType]; ok {
		return sg.DB.Exec(query, args...)
	} else {
		return nil, fmt.Errorf("不存在RunExec类型")
	}
}

func (sg *SqlGather) RunQueryTx(tx *sql.Tx, runType string, args ...any) []map[string]any {
	results := []map[string]any{}
	if query, ok := SqlMap[runType]; ok {
		results = sg.DB.QueryListTx(tx, query, args...)
	} else {
		log.Println("不存在RunQuery类型")
	}
	return results
}

func (sg *SqlGather) RunExecTx(tx *sql.Tx, runType string, args ...any) (sql.Result, error) {
	if query, ok := SqlMap[runType]; ok {
		return tx.Exec(query, args...)
	} else {
		return nil, fmt.Errorf("不存在RunExecTx类型")
	}
}

func (sg *SqlGather) RunTransaction(opts *sql.TxOptions, fn func(*sql.Tx) error) error {
	return sg.DB.Transaction(opts, fn)
}
