### 事务方法(Transaction)的使用案例
```golang
err := Transaction(db, nil, func(tx *sql.Tx) error {
    // 执行事务操作1
    if _, err := tx.Exec("INSERT INTO users(name) VALUES(?)", "Alice"); err != nil {
        return err
    }
    
    // 执行事务操作2
    if _, err := tx.Exec("UPDATE accounts SET balance = balance - ?", 100); err != nil {
        return err
    }
    
    return nil
})

if err != nil {
    log.Printf("Transaction failed: %v", err)
}
```