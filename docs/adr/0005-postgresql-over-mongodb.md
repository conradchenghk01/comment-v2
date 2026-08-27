# PostgreSQL over MongoDB

評論系統的資料天生關聯性強：兩層樹狀結構（主評論→分支→回覆，含結構化 reply_to）、emoji 的 unique constraint（每人每則每 emoji 一次）、額度控制（精確查詢今日送出數）、審計紀錄（操作員→行為→目標的 JOIN）、cursor 分頁。這些都是 SQL 的舒適圈、MongoDB 的折騰點。送留言涉及多表原子寫（comment + quota + audit），需要 ACID transaction。選 PostgreSQL。
