# 第十二篇：网络协议与 HTTP

> 🌐 从零开始理解计算机网络——从底层协议到应用层 API 设计

---

## 目录

- [第一章：网络基础](#第一章网络基础)
- [第二章：TCP 协议](#第二章tcp-协议)
- [第三章：HTTP 协议](#第三章http-协议)
- [第四章：HTTPS 与 TLS](#第四章https-与-tls)
- [第五章：WebSocket 协议](#第五章websocket-协议)
- [第六章：RESTful API 设计](#第六章restful-api-设计)
- [第七章：gRPC 与 GraphQL](#第七章grpc-与-graphql)
- [第八章：网络调试工具](#第八章网络调试工具)

---

# 第一章：网络基础

## 1.1 为什么需要学习网络协议？

想象一下你要给远方的朋友寄一封信。你需要：

1. 写好信的内容（**应用层**）
2. 把信装进信封，写上地址（**传输层**）
3. 邮局分拣、选择路线（**网络层**）
4. 实际的运输方式——飞机、火车、汽车（**数据链路层/物理层**）

计算机网络的工作原理与此类似。不同设备之间要通信，就必须遵循一套共同的规则——这就是**网络协议**。

> 💡 **初学者提示：** 不需要一次记住所有概念。先理解整体框架，细节在实践中慢慢加深。

## 1.2 OSI 七层模型

OSI（Open Systems Interconnection）模型是国际标准化组织提出的网络通信参考模型，将网络通信分为七层：

```mermaid
graph TB
    subgraph "OSI 七层模型"
        L7["第 7 层：应用层<br/>Application Layer<br/>HTTP, FTP, SMTP, DNS"]
        L6["第 6 层：表示层<br/>Presentation Layer<br/>SSL/TLS, JPEG, ASCII"]
        L5["第 5 层：会话层<br/>Session Layer<br/>NetBIOS, RPC"]
        L4["第 4 层：传输层<br/>Transport Layer<br/>TCP, UDP"]
        L3["第 3 层：网络层<br/>Network Layer<br/>IP, ICMP, ARP"]
        L2["第 2 层：数据链路层<br/>Data Link Layer<br/>Ethernet, Wi-Fi"]
        L1["第 1 层：物理层<br/>Physical Layer<br/>电缆、光纤、无线电波"]
    end

    L7 --> L6 --> L5 --> L4 --> L3 --> L2 --> L1

    style L7 fill:#FF6B6B,color:#fff
    style L6 fill:#FF8E53,color:#fff
    style L5 fill:#FFA726,color:#fff
    style L4 fill:#66BB6A,color:#fff
    style L3 fill:#42A5F5,color:#fff
    style L2 fill:#5C6BC0,color:#fff
    style L1 fill:#AB47BC,color:#fff
```

### 各层详解

| 层次 | 名称 | 功能 | 协议/技术示例 | 数据单位 |
|------|------|------|--------------|---------|
| 7 | 应用层 | 为应用程序提供网络服务 | HTTP, HTTPS, FTP, SMTP, DNS, SSH | 数据（Data） |
| 6 | 表示层 | 数据格式转换、加密解密 | SSL/TLS, JPEG, GIF, ASCII, EBCDIC | 数据（Data） |
| 5 | 会话层 | 建立、管理和终止会话 | NetBIOS, RPC, PPTP | 数据（Data） |
| 4 | 传输端到端通信、流量控制 | TCP, UDP, SCTP | 段（Segment）/ 数据报（Datagram） |
| 3 | 网络层 | 路由选择、逻辑寻址 | IP, ICMP, IGMP, OSPF | 包（Packet） |
| 2 | 数据链路层 | 帧传输、差错检测 | Ethernet, Wi-Fi, PPP, VLAN | 帧（Frame） |
| 1 | 物理层 | 比特流传输 | RJ45, 光纤, 无线电波 | 比特（Bit） |

### 数据封装过程

数据在网络中传输时，每一层都会添加自己的"信封"（头部信息）：

```mermaid
graph LR
    subgraph "发送端封装过程"
        A["应用数据<br/>(Data)"] --> B["+ TCP 头<br/>(Segment)"]
        B --> C["+ IP 头<br/>(Packet)"]
        C --> D["+ 帧头帧尾<br/>(Frame)"]
        D --> E["转为比特流<br/>(Bits)"]
    end

    style A fill:#FF6B6B,color:#fff
    style B fill:#66BB6A,color:#fff
    style C fill:#42A5F5,color:#fff
    style D fill:#5C6BC0,color:#fff
    style E fill:#AB47BC,color:#fff
```

## 1.3 TCP/IP 四层模型

TCP/IP 模型是互联网实际使用的协议栈，比 OSI 模型更简洁实用：

```mermaid
graph TB
    subgraph "TCP/IP 四层模型"
        T4["应用层<br/>Application Layer<br/>HTTP, FTP, DNS, SMTP, SSH"]
        T3["传输层<br/>Transport Layer<br/>TCP, UDP"]
        T2["网络层<br/>Internet Layer<br/>IP, ICMP, ARP"]
        T1["网络接口层<br/>Network Interface Layer<br/>Ethernet, Wi-Fi"]
    end

    T4 --> T3 --> T2 --> T1

    style T4 fill:#FF6B6B,color:#fff
    style T3 fill:#66BB6A,color:#fff
    style T2 fill:#42A5F5,color:#fff
    style T1 fill:#AB47BC,color:#fff
```

### OSI vs TCP/IP 对比

```mermaid
graph LR
    subgraph "OSI 七层"
        O7["应用层"]
        O6["表示层"]
        O5["会话层"]
        O4["传输层"]
        O3["网络层"]
        O2["数据链路层"]
        O1["物理层"]
    end

    subgraph "TCP/IP 四层"
        T4["应用层"]
        T3["传输层"]
        T2["网络层"]
        T1["网络接口层"]
    end

    O7 -.-> T4
    O6 -.-> T4
    O5 -.-> T4
    O4 -.-> T3
    O3 -.-> T2
    O2 -.-> T1
    O1 -.-> T1
```

| 对比维度 | OSI 七层模型 | TCP/IP 四层模型 |
|---------|-------------|----------------|
| 层数 | 7 层 | 4 层 |
| 设计理念 | 先有模型，后有实现 | 先有实现，后有模型 |
| 实际应用 | 教学参考 | 互联网标准 |
| 应用层 | 分为应用层、表示层、会话层 | 合并为一个应用层 |
| 网络接口层 | 分为数据链路层、物理层 | 合并为网络接口层 |
| 协议依赖 | 通用框架，不依赖特定协议 | 以 TCP/IP 协议为核心 |
| 适用场景 | 理论学习、网络设计 | 实际开发、网络编程 |

> 💡 **实用建议：** 在日常开发中，我们主要关注 **应用层**（HTTP/WebSocket）和 **传输层**（TCP/UDP）。底层细节由操作系统和网络设备处理。

## 1.4 IP 地址与端口

### IP 地址

IP 地址是网络中设备的唯一标识，就像你家的门牌号。

#### IPv4 地址

IPv4 使用 32 位地址，通常用点分十进制表示：

```
192.168.1.100
└─┬──┘ └─┬─┘
 网络号   主机号
```

**IPv4 地址分类：**

| 类别 | 范围 | 默认子网掩码 | 用途 |
|------|------|-------------|------|
| A 类 | 1.0.0.0 - 126.255.255.255 | 255.0.0.0 (/8) | 大型组织 |
| B 类 | 128.0.0.0 - 191.255.255.255 | 255.255.0.0 (/16) | 中型组织 |
| C 类 | 192.0.0.0 - 223.255.255.255 | 255.255.255.0 (/24) | 小型组织 |
| D 类 | 224.0.0.0 - 239.255.255.255 | - | 组播 |
| E 类 | 240.0.0.0 - 255.255.255.255 | - | 保留 |

**私有 IP 地址（不可在公网路由）：**

| 类别 | 范围 | 常见用途 |
|------|------|---------|
| A 类 | 10.0.0.0 - 10.255.255.255 | 企业内网 |
| B 类 | 172.16.0.0 - 172.31.255.255 | Docker 默认网络 |
| C 类 | 192.168.0.0 - 192.168.255.255 | 家庭路由器 |

**特殊地址：**

| 地址 | 含义 |
|------|------|
| 127.0.0.1 | 本机回环地址（localhost） |
| 0.0.0.0 | 监听所有网络接口 |
| 255.255.255.255 | 广播地址 |

#### IPv6 地址

IPv6 使用 128 位地址，解决 IPv4 地址耗尽问题：

```
2001:0db8:85a3:0000:0000:8a2e:0370:7334
```

**IPv4 vs IPv6 对比：**

| 对比维度 | IPv4 | IPv6 |
|---------|------|------|
| 地址长度 | 32 位 | 128 位 |
| 地址数量 | ~43 亿 | ~3.4×10³⁸ |
| 表示方法 | 点分十进制 | 冒号十六进制 |
| 示例 | 192.168.1.1 | 2001:db8::1 |
| 子网掩码 | 必须手动配置 | 前缀长度自动获取 |
| NAT | 广泛使用 | 不需要（地址充足） |
| 安全性 | IPSec 可选 | IPSec 内置 |

### 端口（Port）

端口是传输层的概念，用于区分同一台设备上的不同服务。

```mermaid
graph LR
    subgraph "客户端"
        C1["浏览器<br/>端口:52341"]
        C2["微信<br/>端口:52342"]
    end

    subgraph "服务器 192.168.1.100"
        S1["Web 服务<br/>端口:80"]
        S2["SSH 服务<br/>端口:22"]
        S3["数据库<br/>端口:3306"]
    end

    C1 -->|"连接到 :80"| S1
    C2 -->|"连接到 :80"| S1
    C1 -->|"连接到 :22"| S2
```

**端口范围：**

| 范围 | 类别 | 说明 | 示例 |
|------|------|------|------|
| 0 - 1023 | 知名端口 | 系统服务使用，需要 root 权限 | HTTP:80, HTTPS:443, SSH:22 |
| 1024 - 49151 | 注册端口 | 应用程序注册使用 | MySQL:3306, Redis:6379 |
| 49152 - 65535 | 动态端口 | 客户端临时使用 | 操作系统自动分配 |

**常见端口速查表：**

| 服务 | 端口 | 协议 | 说明 |
|------|------|------|------|
| HTTP | 80 | TCP | Web 服务 |
| HTTPS | 443 | TCP | 加密 Web 服务 |
| SSH | 22 | TCP | 远程登录 |
| FTP | 21 | TCP | 文件传输（控制） |
| FTP 数据 | 20 | TCP | 文件传输（数据） |
| SMTP | 25/587 | TCP | 发送邮件 |
| POP3 | 110 | TCP | 接收邮件 |
| IMAP | 143 | TCP | 接收邮件 |
| DNS | 53 | TCP/UDP | 域名解析 |
| MySQL | 3306 | TCP | MySQL 数据库 |
| PostgreSQL | 5432 | TCP | PostgreSQL 数据库 |
| Redis | 6379 | TCP | Redis 缓存 |
| MongoDB | 27017 | TCP | MongoDB 数据库 |

## 1.5 DNS 解析流程

DNS（Domain Name System）将人类可读的域名转换为机器可读的 IP 地址。

### DNS 解析完整流程

```mermaid
sequenceDiagram
    participant User as 用户浏览器
    participant Browser as 浏览器 DNS 缓存
    participant OS as 操作系统 DNS 缓存
    participant Hosts as hosts 文件
    participant LDNS as 本地 DNS 服务器<br/>(ISP)
    participant Root as 根域名服务器
    participant TLD as 顶级域名服务器<br/>(.com)
    participant Auth as 权威域名服务器<br/>(example.com)

    User->>Browser: 请求 www.example.com
    Browser->>Browser: 1. 检查浏览器缓存

    alt 缓存命中
        Browser-->>User: 返回 IP 地址
    else 缓存未命中
        Browser->>OS: 2. 请求操作系统解析
        OS->>OS: 检查 OS DNS 缓存

        alt OS 缓存命中
            OS-->>User: 返回 IP 地址
        else OS 缓存未命中
            OS->>Hosts: 3. 检查 hosts 文件
            Hosts-->>OS: 未找到
            OS->>LDNS: 4. 查询本地 DNS 服务器
            LDNS->>LDNS: 检查本地缓存

            alt 本地缓存命中
                LDNS-->>User: 返回 IP 地址
            else 本地缓存未命中
                LDNS->>Root: 5. 查询根域名服务器
                Root-->>LDNS: 返回 .com TLD 服务器地址
                LDNS->>TLD: 6. 查询 .com TLD 服务器
                TLD-->>LDNS: 返回 example.com 权威服务器地址
                LDNS->>Auth: 7. 查询权威域名服务器
                Auth-->>LDNS: 返回 www.example.com 的 IP: 93.184.216.34
                LDNS->>LDNS: 缓存结果
                LDNS-->>OS: 返回 IP 地址
                OS->>OS: 缓存结果
                OS-->>Browser: 返回 IP 地址
                Browser->>Browser: 缓存结果
                Browser-->>User: 返回 IP 地址
            end
        end
    end
```

### DNS 查询类型

| 查询类型 | 说明 | 示例 |
|---------|------|------|
| A 记录 | 域名 → IPv4 地址 | example.com → 93.184.216.34 |
| AAAA 记录 | 域名 → IPv6 地址 | example.com → 2606:2800:220:1:... |
| CNAME 记录 | 域名别名 | www.example.com → example.com |
| MX 记录 | 邮件服务器 | example.com → mail.example.com |
| NS 记录 | 域名服务器 | example.com → ns1.example.com |
| TXT 记录 | 文本记录 | SPF、DKIM 验证 |
| PTR 记录 | IP → 域名（反向解析） | 93.184.216.34 → example.com |
| SRV 记录 | 服务发现 | _http._tcp.example.com |

### DNS 缓存时间（TTL）

```
;; ANSWER SECTION:
www.example.com.    300    IN    A    93.184.216.34
;;                 ↑ TTL（秒）
```

| TTL 值 | 含义 | 适用场景 |
|--------|------|---------|
| 60 秒 | 1 分钟 | 频繁变更的服务（CDN、负载均衡） |
| 300 秒 | 5 分钟 | 一般网站 |
| 3600 秒 | 1 小时 | 稳定的服务 |
| 86400 秒 | 24 小时 | 很少变更的记录 |

### 实际 DNS 查询示例

```bash
# 使用 dig 查询 A 记录
$ dig www.example.com A

; <<>> DiG 9.18.1 <<>> www.example.com A
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 12345
;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1

;; QUESTION SECTION:
;www.example.com.       IN  A

;; ANSWER SECTION:
www.example.com.    300  IN  A  93.184.216.34

;; Query time: 28 msec
;; SERVER: 8.8.8.8#53(8.8.8.8)

# 使用 nslookup
$ nslookup www.example.com
Server:     8.8.8.8
Address:    8.8.8.8#53

Non-authoritative answer:
Name:   www.example.com
Address: 93.184.216.34

# 使用 host
$ host www.example.com
www.example.com has address 93.184.216.34
www.example.com has IPv6 address 2606:2800:220:1:248:1893:25c8:1946
```

### DNS 解析在移动端的优化

```mermaid
graph TB
    subgraph "DNS 优化策略"
        A["DNS 预解析<br/>在用户点击前就开始解析"]
        B["DNS 缓存<br/>本地缓存解析结果"]
        C["HTTPDNS<br/>绕过运营商 DNS"]
        D["连接复用<br/>减少 DNS 查询次数"]
    end

    subgraph "HTTPDNS 优势"
        E["避免 DNS 劫持"]
        F["精准调度"]
        G["解析速度更快"]
    end

    C --> E
    C --> F
    C --> G
```

| 优化策略 | 原理 | 实现方式 | 效果 |
|---------|------|---------|------|
| DNS 预解析 | 提前解析域名 | `<link rel="dns-prefetch">` | 减少 200-500ms |
| DNS 缓存 | 缓存解析结果 | 客户端内存缓存 | 避免重复查询 |
| HTTPDNS | HTTP 请求直接获取 IP | 阿里云/腾讯云 HTTPDNS | 避免劫持，更精准 |
| 连接复用 | 复用已有连接 | HTTP Keep-Alive | 减少 DNS 查询 |

```html
<!-- DNS 预解析示例 -->
<html>
<head>
    <!-- 预解析可能用到的域名 -->
    <link rel="dns-prefetch" href="//cdn.example.com">
    <link rel="dns-prefetch" href="//api.example.com">
    <link rel="dns-prefetch" href="//static.example.com">
</head>
</html>
```

## 1.6 网络通信全景图

```mermaid
graph TB
    subgraph "客户端"
        APP["应用程序"]
        HTTP["HTTP/WebSocket"]
        TCP["TCP/UDP"]
        IP_C["IP"]
        ETH_C["以太网/Wi-Fi"]
    end

    subgraph "网络"
        ROUTER["路由器"]
        ISP["ISP 网络"]
        CDN["CDN 节点"]
    end

    subgraph "服务器"
        LB["负载均衡器"]
        WEB["Web 服务器"]
        APP_S["应用服务"]
        DB["数据库"]
    end

    APP --> HTTP --> TCP --> IP_C --> ETH_C
    ETH_C --> ROUTER --> ISP --> CDN
    CDN --> LB --> WEB --> APP_S --> DB
```

---

# 第二章：TCP 协议

## 2.1 TCP 概述

TCP（Transmission Control Protocol，传输控制协议）是互联网核心协议之一，提供**可靠的、面向连接的**字节流传输服务。

### TCP 的核心特性

| 特性 | 说明 | 机制 |
|------|------|------|
| 面向连接 | 通信前需要建立连接 | 三次握手 |
| 可靠传输 | 保证数据不丢失、不重复、有序 | 确认应答、超时重传 |
| 流量控制 | 防止发送方淹没接收方 | 滑动窗口 |
| 拥塞控制 | 防止网络拥塞 | 慢启动、拥塞避免 |
| 全双工 | 双方可同时发送数据 | 双向缓冲区 |
| 面向字节流 | 数据以字节流形式传输 | 无消息边界 |

## 2.2 TCP 三次握手（Three-Way Handshake）

三次握手是建立 TCP 连接的过程，确保双方都准备好通信。

```mermaid
sequenceDiagram
    participant C as 客户端<br/>(Client)
    participant S as 服务器<br/>(Server)

    Note over C,S: TCP 三次握手过程

    C->>S: 第 1 次握手：SYN=1, seq=x<br/>"我想建立连接，我的初始序列号是 x"
    Note right of C: 状态：SYN_SENT

    S->>C: 第 2 次握手：SYN=1, ACK=1, seq=y, ack=x+1<br/>"同意，我的初始序列号是 y，期待你下次发 x+1"
    Note left of S: 状态：SYN_RECEIVED

    C->>S: 第 3 次握手：ACK=1, seq=x+1, ack=y+1<br/>"收到，期待你下次发 y+1"
    Note right of C: 状态：ESTABLISHED
    Note left of S: 状态：ESTABLISHED

    Note over C,S: 连接建立，开始传输数据
```

### 为什么是三次而不是两次？

```mermaid
sequenceDiagram
    participant C as 客户端
    participant S as 服务器

    Note over C,S: 两次握手的问题

    C->>S: SYN (旧的延迟报文)
    Note left of S: 服务器以为是新连接请求
    S->>C: SYN+ACK
    Note left of S: 服务器分配资源，等待数据
    Note right of C: 客户端：我啥也没发啊？忽略
    Note left of S: 服务器资源浪费！（半开连接）
```

**核心原因：** 三次握手可以防止**历史重复连接**的初始化。如果只有两次握手，服务器无法确认客户端是否收到了自己的 SYN+ACK，可能会建立无效连接，浪费资源。

### 三次握手状态转换

```mermaid
stateDiagram-v2
    [*] --> CLOSED
    CLOSED --> SYN_SENT: 主动发送 SYN
    SYN_SENT --> ESTABLISHED: 收到 SYN+ACK，发送 ACK

    CLOSED --> LISTEN: 被动等待连接
    LISTEN --> SYN_RCVD: 收到 SYN，发送 SYN+ACK
    SYN_RCVD --> ESTABLISHED: 收到 ACK

    ESTABLISHED --> [*]
```

### TCP 报文头部结构

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|          Source Port          |       Destination Port        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                        Sequence Number                        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                    Acknowledgment Number                      |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|  Data |       |C|E|U|A|P|R|S|F|                               |
| Offset| Rsrvd |W|C|R|C|S|S|Y|I|            Window             |
|  (4)  |  (3)  |R|E|G|K|H|T|N|N|                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|           Checksum            |         Urgent Pointer        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

**关键字段说明：**

| 字段 | 长度 | 说明 |
|------|------|------|
| Source Port | 16 位 | 源端口号 |
| Destination Port | 16 位 | 目标端口号 |
| Sequence Number | 32 位 | 序列号，标识数据字节流位置 |
| Acknowledgment Number | 32 位 | 确认号，期望收到的下一字节 |
| Data Offset | 4 位 | TCP 头部长度（以 4 字节为单位） |
| SYN | 1 位 | 同步序列号（建立连接） |
| ACK | 1 位 | 确认号有效 |
| FIN | 1 位 | 发送方数据发送完毕 |
| RST | 1 位 | 重置连接 |
| PSH | 1 位 | 推送数据（立即发送） |
| Window | 16 位 | 接收窗口大小（流量控制） |
| Checksum | 16 位 | 校验和 |

## 2.3 TCP 四次挥手（Four-Way Handshake）

四次挥手是关闭 TCP 连接的过程。

```mermaid
sequenceDiagram
    participant C as 客户端<br/>(Client)
    participant S as 服务器<br/>(Server)

    Note over C,S: TCP 四次挥手过程

    C->>S: 第 1 次挥手：FIN=1, seq=u<br/>"我没有数据要发了"
    Note right of C: 状态：FIN_WAIT_1

    S->>C: 第 2 次挥手：ACK=1, ack=u+1<br/>"收到，但我可能还有数据要发"
    Note left of S: 状态：CLOSE_WAIT
    Note right of C: 状态：FIN_WAIT_2

    Note left of S: 服务器继续发送剩余数据...

    S->>C: 第 3 次挥手：FIN=1, seq=w<br/>"我也没数据要发了"
    Note left of S: 状态：LAST_ACK

    C->>S: 第 4 次挥手：ACK=1, ack=w+1<br/>"收到，再见！"
    Note right of C: 状态：TIME_WAIT（等待 2MSL）

    Note over C,S: 连接关闭
```

### 为什么是四次而不是三次？

TCP 是全双工的，关闭连接需要两个方向分别关闭。服务器收到 FIN 时，可能还有数据没发完，所以先 ACK 确认收到 FIN，等数据发完后再发自己的 FIN。

### TIME_WAIT 状态

```mermaid
sequenceDiagram
    participant C as 客户端
    participant S as 服务器

    Note over C: TIME_WAIT 状态（等待 2MSL）

    Note right of C: MSL = Maximum Segment Lifetime<br/>（报文最大生存时间，默认 60s）
    Note right of C: 2MSL = 2 × 60s = 120s

    Note over C,S: TIME_WAIT 的两个作用：

    Note over C: 1. 确保最后一个 ACK 到达服务器
    Note over C: 如果 ACK 丢失，服务器会重发 FIN
    Note over C: 客户端在 TIME_WAIT 期间可以重发 ACK

    Note over C: 2. 让旧连接的报文在网络中消失
    Note over C: 防止新连接收到旧连接的延迟报文
```

### 四次挥手状态转换

```mermaid
stateDiagram-v2
    [*] --> ESTABLISHED
    ESTABLISHED --> FIN_WAIT_1: 主动关闭，发送 FIN
    FIN_WAIT_1 --> FIN_WAIT_2: 收到 ACK
    FIN_WAIT_2 --> TIME_WAIT: 收到 FIN，发送 ACK
    TIME_WAIT --> CLOSED: 等待 2MSL

    ESTABLISHED --> CLOSE_WAIT: 收到 FIN，发送 ACK
    CLOSE_WAIT --> LAST_ACK: 被动关闭，发送 FIN
    LAST_ACK --> CLOSED: 收到 ACK

    CLOSED --> [*]
```

## 2.4 流量控制

流量控制是为了防止发送方发送速度过快，导致接收方缓冲区溢出。

### 滑动窗口机制

```mermaid
graph LR
    subgraph "发送方缓冲区"
        A["已发送<br/>已确认"] --> B["已发送<br/>未确认"]
        B --> C["可发送<br/>（窗口内）"]
        C --> D["不可发送<br/>（窗口外）"]
    end

    style A fill:#4CAF50,color:#fff
    style B fill:#FFC107,color:#000
    style C fill:#2196F3,color:#fff
    style D fill:#9E9E9E,color:#fff
```

```mermaid
sequenceDiagram
    participant S as 发送方
    participant R as 接收方

    Note over S,R: 滑动窗口流量控制

    R->>S: Window = 4000（接收窗口 4000 字节）
    S->>R: 发送 1000 字节（seq=1）
    S->>R: 发送 1000 字节（seq=1001）
    S->>R: 发送 1000 字节（seq=2001）
    R->>S: ACK=3001, Window=1000（确认收到，窗口缩小）
    S->>R: 发送 1000 字节（seq=3001）
    R->>S: ACK=4001, Window=0（缓冲区满，暂停发送）
    Note over S: 发送方暂停，定期发送窗口探测
    R->>S: ACK=4001, Window=2000（缓冲区有空间了）
    S->>R: 继续发送...
```

### 窗口大小与吞吐量

```
吞吐量 = 窗口大小 / 往返时间（RTT）

示例：
- 窗口大小：64KB = 65536 字节
- RTT：100ms = 0.1s
- 吞吐量 = 65536 / 0.1 = 655,360 字节/秒 ≈ 5.2 Mbps
```

## 2.5 拥塞控制

拥塞控制是为了防止网络过载，通过动态调整发送速率来维护网络健康。

### 四种拥塞控制算法

```mermaid
graph TB
    subgraph "TCP 拥塞控制"
        A["慢启动<br/>Slow Start"] --> B["拥塞避免<br/>Congestion Avoidance"]
        B --> C["快重传<br/>Fast Retransmit"]
        C --> D["快恢复<br/>Fast Recovery"]
        D --> B
    end
```

### 慢启动与拥塞避免

```mermaid
graph LR
    subgraph "拥塞窗口变化"
        direction TB
        X["时间"] --> Y["拥塞窗口大小"]
    end

    subgraph "慢启动阶段"
        SS["指数增长<br/>1→2→4→8→16"]
    end

    subgraph "拥塞避免阶段"
        CA["线性增长<br/>16→17→18→19→20"]
    end

    subgraph "发生拥塞"
        CC["窗口减半或重置"]
    end

    SS -->|"达到 ssthresh"| CA
    CA -->|"丢包"| CC
    CC --> SS
```

| 阶段 | 策略 | 增长方式 | 触发条件 |
|------|------|---------|---------|
| 慢启动 | 指数增长 | cwnd × 2 | 连接开始或超时 |
| 拥塞避免 | 线性增长 | cwnd + 1 | cwnd ≥ ssthresh |
| 快重传 | 立即重传 | - | 收到 3 个重复 ACK |
| 快恢复 | ssthresh = cwnd/2 | 线性增长 | 收到 3 个重复 ACK |

**关键参数：**
- `cwnd`（Congestion Window）：拥塞窗口大小
- `ssthresh`（Slow Start Threshold）：慢启动阈值
- `rwnd`（Receive Window）：接收窗口大小
- 实际发送窗口 = min(cwnd, rwnd)

## 2.6 TCP vs UDP 对比

```mermaid
graph TB
    subgraph "TCP"
        T1["面向连接"] --> T2["可靠传输"]
        T2 --> T3["有序到达"]
        T3 --> T4["流量控制"]
        T4 --> T5["拥塞控制"]
    end

    subgraph "UDP"
        U1["无连接"] --> U2["不可靠传输"]
        U2 --> U3["无序到达"]
        U3 --> U4["无流量控制"]
        U4 --> U5["无拥塞控制"]
    end
```

| 对比维度 | TCP | UDP |
|---------|-----|-----|
| 连接方式 | 面向连接（三次握手） | 无连接 |
| 可靠性 | 可靠（确认应答、重传） | 不可靠 |
| 数据顺序 | 保证有序 | 不保证 |
| 传输方式 | 字节流 | 数据报 |
| 头部开销 | 20-60 字节 | 8 字节 |
| 速度 | 较慢（有开销） | 较快（无开销） |
| 流量控制 | 有（滑动窗口） | 无 |
| 拥塞控制 | 有 | 无 |
| 连接状态 | 有（需维护） | 无 |
| 适用场景 | Web、邮件、文件传输 | 视频、语音、游戏、DNS |

### TCP/UDP 应用场景

| 场景 | 推荐协议 | 原因 |
|------|---------|------|
| 网页浏览（HTTP） | TCP | 需要可靠传输，数据不能丢失 |
| 电子邮件（SMTP） | TCP | 邮件内容必须完整 |
| 文件传输（FTP） | TCP | 文件完整性至关重要 |
| 视频直播 | UDP | 实时性优先，少量丢包可接受 |
| 语音通话（VoIP） | UDP | 延迟敏感，少量丢包不影响理解 |
| 在线游戏 | UDP | 实时性优先，状态可同步修正 |
| DNS 查询 | UDP | 小数据包，快速查询 |
| DNS 区域传输 | TCP | 大数据量，需要可靠传输 |

### TCP 代码示例（Node.js）

```javascript
// TCP 服务器
const net = require('net');

const server = net.createServer((socket) => {
    console.log('客户端已连接');
    console.log(`本地地址: ${socket.localAddress}:${socket.localPort}`);
    console.log(`远程地址: ${socket.remoteAddress}:${socket.remotePort}`);

    // 接收数据
    socket.on('data', (data) => {
        console.log(`收到数据: ${data.toString()}`);
        // 回显数据
        socket.write(`服务器收到: ${data.toString()}`);
    });

    // 连接关闭
    socket.on('end', () => {
        console.log('客户端已断开');
    });

    // 错误处理
    socket.on('error', (err) => {
        console.error(`Socket 错误: ${err.message}`);
    });
});

server.listen(3000, () => {
    console.log('TCP 服务器监听端口 3000');
});

// TCP 客户端
const client = net.createConnection({
    host: '127.0.0.1',
    port: 3000
}, () => {
    console.log('已连接到服务器');
    client.write('Hello, TCP Server!');
});

client.on('data', (data) => {
    console.log(`服务器回复: ${data.toString()}`);
    client.end(); // 关闭连接
});

client.on('end', () => {
    console.log('已断开连接');
});
```

```python
# TCP 服务器（Python）
import socket
import threading

def handle_client(conn, addr):
    print(f"客户端 {addr} 已连接")
    while True:
        data = conn.recv(1024)
        if not data:
            break
        print(f"收到: {data.decode()}")
        conn.send(f"服务器收到: {data.decode()}".encode())
    conn.close()
    print(f"客户端 {addr} 已断开")

server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.bind(('0.0.0.0', 3000))
server.listen(5)
print("TCP 服务器监听端口 3000")

while True:
    conn, addr = server.accept()
    thread = threading.Thread(target=handle_client, args=(conn, addr))
    thread.start()
```

### UDP 代码示例（Node.js）

```javascript
// UDP 服务器
const dgram = require('dgram');
const server = dgram.createSocket('udp4');

server.on('message', (msg, rinfo) => {
    console.log(`收到来自 ${rinfo.address}:${rinfo.port} 的消息: ${msg}`);
    // 回显
    server.send(`Echo: ${msg}`, rinfo.port, rinfo.address);
});

server.bind(4000, () => {
    console.log('UDP 服务器监听端口 4000');
});

// UDP 客户端
const client = dgram.createSocket('udp4');
const message = Buffer.from('Hello, UDP Server!');

client.send(message, 4000, '127.0.0.1', (err) => {
    if (err) console.error(err);
    console.log('消息已发送');
});

client.on('message', (msg) => {
    console.log(`服务器回复: ${msg.toString()}`);
    client.close();
});
```

---

# 第三章：HTTP 协议

## 3.1 HTTP 概述

HTTP（HyperText Transfer Protocol，超文本传输协议）是 Web 的基础协议，用于传输超文本文档（HTML）及其他资源。

### HTTP 的演进历史

```mermaid
timeline
    title HTTP 协议演进
    1991 : HTTP/0.9
         : 只支持 GET
         : 只能传输 HTML
    1996 : HTTP/1.0
         : 引入请求头/响应头
         : 支持多种方法
         : 支持多种内容类型
    1997 : HTTP/1.1
         : 持久连接
         : 管道化
         : 分块传输
    2015 : HTTP/2
         : 二进制分帧
         : 多路复用
         : 头部压缩
         : 服务器推送
    2022 : HTTP/3
         : 基于 QUIC (UDP)
         : 更快的连接建立
         : 改进的多路复用
    end
```

### HTTP 特性

| 特性 | 说明 |
|------|------|
| 无状态 | 每个请求独立，服务器不记住之前的请求 |
| 无连接 | 早期版本每次请求都建立新连接（HTTP/1.1 改进） |
| 可扩展 | 通过自定义头部扩展功能 |
| 基于请求/响应 | 客户端发起请求，服务器返回响应 |
| 跨平台 | 任何平台都可以实现 HTTP |

## 3.2 HTTP/1.1 vs HTTP/2 vs HTTP/3

```mermaid
graph TB
    subgraph "HTTP/1.1"
        H1["文本协议"]
        H1A["每个连接一个请求"]
        H1B["队头阻塞"]
        H1C["无头部压缩"]
    end

    subgraph "HTTP/2"
        H2["二进制协议"]
        H2A["多路复用"]
        H2B["流级别并行"]
        H2C["HPACK 头部压缩"]
    end

    subgraph "HTTP/3"
        H3["基于 QUIC/UDP"]
        H3A["连接级别多路复用"]
        H3B["无队头阻塞"]
        H3C["0-RTT 连接建立"]
    end

    H1 -->|"升级"| H2
    H2 -->|"革命"| H3
```

| 对比维度 | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---------|----------|--------|--------|
| 传输层 | TCP | TCP | QUIC (UDP) |
| 协议格式 | 文本 | 二进制 | 二进制 |
| 连接复用 | 不支持（管道化有缺陷） | 支持（流级别） | 支持（连接级别） |
| 队头阻塞 | 有 | 有（TCP 层面） | 无 |
| 头部压缩 | 无 | HPACK | QPACK |
| 服务器推送 | 不支持 | 支持 | 支持 |
| 连接建立 | 1-3 RTT | 1-3 RTT | 0-1 RTT |
| 加密 | 可选 | 事实标准 TLS | 强制加密 |
| 浏览器支持 | 所有浏览器 | 所有现代浏览器 | Chrome, Firefox, Edge |

### 队头阻塞问题

```mermaid
sequenceDiagram
    participant C as 客户端
    participant S as 服务器

    Note over C,S: HTTP/1.1 队头阻塞

    C->>S: 请求 1 (index.html)
    Note over C: 等待响应 1...
    S->>C: 响应 1
    C->>S: 请求 2 (style.css)
    Note over C: 等待响应 2...
    S->>C: 响应 2
    C->>S: 请求 3 (script.js)
    Note over C: 等待响应 3...
    S->>C: 响应 3

    Note over C,S: HTTP/2 多路复用

    par 并行传输
        C->>S: 请求 1 (stream 1)
        C->>S: 请求 2 (stream 2)
        C->>S: 请求 3 (stream 3)
    and
        S->>C: 响应 2 (stream 2) 先到达
        S->>C: 响应 1 (stream 1)
        S->>C: 响应 3 (stream 3)
    end
```

### HTTP/2 帧格式

```
+-----------------------------------------------+
|                 Length (24)                    |
+---------------+---------------+---------------+
|   Type (8)    |   Flags (8)   |
+-+-------------+---------------+---------------+
|R|         Stream Identifier (31)              |
+-+---------------------------------------------+
|                   Frame Payload ...            |
+-----------------------------------------------+
```

| 帧类型 | 代码 | 说明 |
|--------|------|------|
| DATA | 0x0 | 传输数据 |
| HEADERS | 0x1 | 传输头部 |
| PRIORITY | 0x2 | 流优先级 |
| RST_STREAM | 0x3 | 终止流 |
| SETTINGS | 0x4 | 配置参数 |
| PUSH_PROMISE | 0x5 | 服务器推送 |
| PING | 0x6 | 心跳检测 |
| GOAWAY | 0x7 | 通知关闭连接 |
| WINDOW_UPDATE | 0x8 | 流量控制 |
| CONTINUATION | 0x9 | 继续传输头部 |

## 3.3 请求/响应报文结构

### HTTP 请求报文

```
┌─────────────────────────────────────────────┐
│ 请求行 (Request Line)                        │
│ POST /api/users HTTP/1.1                     │
├─────────────────────────────────────────────┤
│ 请求头 (Request Headers)                     │
│ Host: api.example.com                        │
│ Content-Type: application/json               │
│ Authorization: Bearer eyJhbGci...            │
│ Accept: application/json                     │
│ User-Agent: MyApp/1.0                        │
│ Connection: keep-alive                       │
├─────────────────────────────────────────────┤
│ 空行                                         │
├─────────────────────────────────────────────┤
│ 请求体 (Request Body)                        │
│ {"name": "John", "email": "john@example.com"}│
└─────────────────────────────────────────────┘
```

### HTTP 响应报文

```
┌─────────────────────────────────────────────┐
│ 状态行 (Status Line)                         │
│ HTTP/1.1 201 Created                         │
├─────────────────────────────────────────────┤
│ 响应头 (Response Headers)                    │
│ Content-Type: application/json               │
│ Content-Length: 45                            │
│ Cache-Control: no-cache                      │
│ Set-Cookie: session=abc123; HttpOnly         │
│ X-Request-Id: req-12345                      │
├─────────────────────────────────────────────┤
│ 空行                                         │
├─────────────────────────────────────────────┤
│ 响应体 (Response Body)                       │
│ {"id": 1, "name": "John", "email": "john@...│
└─────────────────────────────────────────────┘
```

### 请求报文字段详解

| 组成部分 | 说明 | 示例 |
|---------|------|------|
| 方法（Method） | 操作类型 | GET, POST, PUT, DELETE |
| URL | 请求路径 | /api/users?page=1 |
| 版本 | HTTP 版本 | HTTP/1.1 |
| 请求头 | 元信息 | Content-Type, Authorization |
| 空行 | 分隔头部和体 | CRLF |
| 请求体 | 发送的数据 | JSON, Form Data |

### 常见请求头

| 请求头 | 说明 | 示例值 |
|--------|------|--------|
| Host | 目标主机（必须） | api.example.com |
| Content-Type | 请求体类型 | application/json |
| Content-Length | 请求体长度 | 256 |
| Authorization | 认证信息 | Bearer eyJhbG... |
| Accept | 可接受的响应类型 | application/json |
| Accept-Encoding | 可接受的压缩方式 | gzip, deflate, br |
| Accept-Language | 可接受的语言 | zh-CN, en-US |
| User-Agent | 客户端信息 | Mozilla/5.0... |
| Connection | 连接管理 | keep-alive |
| Cache-Control | 缓存策略 | no-cache |
| Cookie | Cookie 信息 | session=abc123 |
| Referer | 来源页面 | https://example.com/ |
| Origin | 请求来源（CORS） | https://example.com |
| If-None-Match | 条件请求（ETag） | "etag-value" |
| If-Modified-Since | 条件请求（时间） | Wed, 21 Oct 2015 07:28:00 GMT |

### 常见响应头

| 响应头 | 说明 | 示例值 |
|--------|------|--------|
| Content-Type | 响应体类型 | application/json; charset=utf-8 |
| Content-Length | 响应体长度 | 1024 |
| Content-Encoding | 压缩方式 | gzip |
| Cache-Control | 缓存策略 | max-age=3600 |
| ETag | 资源标识 | "33a64df551425fcc55e4d42a148795d9f25f89d4" |
| Last-Modified | 最后修改时间 | Wed, 21 Oct 2015 07:28:00 GMT |
| Set-Cookie | 设置 Cookie | session=abc; HttpOnly; Secure |
| Location | 重定向地址 | /new-url |
| Access-Control-Allow-Origin | CORS 配置 | * 或 https://example.com |
| X-Request-Id | 请求追踪 ID | uuid-string |
| Strict-Transport-Security | HSTS 策略 | max-age=31536000 |

## 3.4 HTTP 方法语义

```mermaid
graph TB
    subgraph "HTTP 方法"
        GET["GET<br/>获取资源"]
        POST["POST<br/>创建资源"]
        PUT["PUT<br/>替换资源"]
        PATCH["PATCH<br/>部分更新"]
        DELETE["DELETE<br/>删除资源"]
        HEAD["HEAD<br/>获取头部"]
        OPTIONS["OPTIONS<br/>获取支持的方法"]
        TRACE["TRACE<br/>回显请求"]
        CONNECT["CONNECT<br/>建立隧道"]
    end
```

| 方法 | 语义 | 幂等 | 安全 | 请求体 | 响应体 | 常见用途 |
|------|------|------|------|--------|--------|---------|
| GET | 获取资源 | ✅ | ✅ | ❌ | ✅ | 获取列表、详情 |
| POST | 创建资源 | ❌ | ❌ | ✅ | ✅ | 创建数据、提交表单 |
| PUT | 替换资源 | ✅ | ❌ | ✅ | ✅ | 更新整个资源 |
| PATCH | 部分更新 | ❌* | ❌ | ✅ | ✅ | 更新部分字段 |
| DELETE | 删除资源 | ✅ | ❌ | ❌ | ❌* | 删除数据 |
| HEAD | 获取元信息 | ✅ | ✅ | ❌ | ❌ | 检查资源是否存在 |
| OPTIONS | 获取能力 | ✅ | ✅ | ❌ | ✅ | CORS 预检请求 |

> **幂等（Idempotent）：** 多次请求与一次请求的效果相同。
> **安全（Safe）：** 不会修改服务器上的资源。

### 各方法详细示例

#### GET - 获取资源

```http
GET /api/users/123 HTTP/1.1
Host: api.example.com
Accept: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

HTTP/1.1 200 OK
Content-Type: application/json

{
    "id": 123,
    "name": "张三",
    "email": "zhangsan@example.com",
    "created_at": "2024-01-01T00:00:00Z"
}
```

#### POST - 创建资源

```http
POST /api/users HTTP/1.1
Host: api.example.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
    "name": "李四",
    "email": "lisi@example.com",
    "password": "securepassword123"
}

HTTP/1.1 201 Created
Content-Type: application/json
Location: /api/users/124

{
    "id": 124,
    "name": "李四",
    "email": "lisi@example.com",
    "created_at": "2024-01-02T00:00:00Z"
}
```

#### PUT - 替换资源

```http
PUT /api/users/123 HTTP/1.1
Host: api.example.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
    "name": "张三丰",
    "email": "zhangsanfeng@example.com",
    "role": "admin"
}

HTTP/1.1 200 OK
Content-Type: application/json

{
    "id": 123,
    "name": "张三丰",
    "email": "zhangsanfeng@example.com",
    "role": "admin",
    "updated_at": "2024-01-03T00:00:00Z"
}
```

#### PATCH - 部分更新

```http
PATCH /api/users/123 HTTP/1.1
Host: api.example.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
    "email": "newemail@example.com"
}

HTTP/1.1 200 OK
Content-Type: application/json

{
    "id": 123,
    "name": "张三丰",
    "email": "newemail@example.com",
    "role": "admin"
}
```

#### DELETE - 删除资源

```http
DELETE /api/users/123 HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

HTTP/1.1 204 No Content
```

## 3.5 状态码分类

```mermaid
graph TB
    subgraph "HTTP 状态码"
        S1["1xx 信息性<br/>请求已接收，继续处理"]
        S2["2xx 成功<br/>请求已成功处理"]
        S3["3xx 重定向<br/>需要进一步操作"]
        S4["4xx 客户端错误<br/>请求有误"]
        S5["5xx 服务器错误<br/>服务器处理失败"]
    end

    style S1 fill:#90CAF9,color:#000
    style S2 fill:#A5D6A7,color:#000
    style S3 fill:#FFF59D,color:#000
    style S4 fill:#FFAB91,color:#000
    style S5 fill:#EF9A9A,color:#000
```

### 1xx 信息性状态码

| 状态码 | 名称 | 说明 | 使用场景 |
|--------|------|------|---------|
| 100 | Continue | 请继续发送请求体 | 大文件上传前的确认 |
| 101 | Switching Protocols | 协议切换 | WebSocket 升级 |
| 102 | Processing | 正在处理 | WebDAV 长时间操作 |
| 103 | Early Hints | 预加载提示 | 预加载资源 |

### 2xx 成功状态码

| 状态码 | 名称 | 说明 | 使用场景 |
|--------|------|------|---------|
| 200 | OK | 请求成功 | GET、PUT、PATCH |
| 201 | Created | 资源已创建 | POST 创建资源 |
| 202 | Accepted | 已接受处理 | 异步任务提交 |
| 204 | No Content | 无响应体 | DELETE 成功 |
| 206 | Partial Content | 部分内容 | 断点续传、范围请求 |

### 3xx 重定向状态码

| 状态码 | 名称 | 说明 | 缓存 |
|--------|------|------|------|
| 301 | Moved Permanently | 永久重定向 | 可缓存 |
| 302 | Found | 临时重定向 | 不缓存 |
| 303 | See Other | 查看其他位置 | 不缓存 |
| 304 | Not Modified | 资源未修改 | 使用缓存 |
| 307 | Temporary Redirect | 临时重定向（保持方法） | 不缓存 |
| 308 | Permanent Redirect | 永久重定向（保持方法） | 可缓存 |

### 4xx 客户端错误状态码

| 状态码 | 名称 | 说明 | 常见原因 |
|--------|------|------|---------|
| 400 | Bad Request | 请求格式错误 | 参数缺失、JSON 格式错误 |
| 401 | Unauthorized | 未认证 | 缺少或无效的 Token |
| 403 | Forbidden | 无权限 | 认证成功但权限不足 |
| 404 | Not Found | 资源不存在 | URL 错误、资源已删除 |
| 405 | Method Not Allowed | 方法不允许 | 对只读资源使用 POST |
| 408 | Request Timeout | 请求超时 | 客户端发送太慢 |
| 409 | Conflict | 冲突 | 重复创建、版本冲突 |
| 413 | Payload Too Large | 请求体过大 | 文件上传超过限制 |
| 415 | Unsupported Media Type | 不支持的媒体类型 | Content-Type 不正确 |
| 422 | Unprocessable Entity | 无法处理 | 语义错误（验证失败） |
| 429 | Too Many Requests | 请求过多 | 触发限流 |

### 5xx 服务器错误状态码

| 状态码 | 名称 | 说明 | 常见原因 |
|--------|------|------|---------|
| 500 | Internal Server Error | 服务器内部错误 | 代码 Bug、未捕获异常 |
| 501 | Not Implemented | 未实现 | 服务器不支持该方法 |
| 502 | Bad Gateway | 网关错误 | 上游服务不可用 |
| 503 | Service Unavailable | 服务不可用 | 服务器过载、维护中 |
| 504 | Gateway Timeout | 网关超时 | 上游服务响应超时 |

## 3.6 Cookie 与 Session

### 无状态的 HTTP 与状态管理需求

```mermaid
sequenceDiagram
    participant C as 客户端
    participant S as 服务器

    Note over C,S: 无状态的问题

    C->>S: 请求 1：登录（用户名+密码）
    S->>C: 响应 1：登录成功
    C->>S: 请求 2：获取个人信息
    Note left of S: 你是谁？我不记得了...
    S->>C: 响应 2：401 未认证

    Note over C,S: 使用 Cookie/Session 解决

    C->>S: 请求 1：登录（用户名+密码）
    S->>C: 响应 1：Set-Cookie: session=abc123
    C->>S: 请求 2：Cookie: session=abc123
    Note left of S: session=abc123 → 这是张三
    S->>C: 响应 2：张三的个人信息
```

### Cookie 机制

```mermaid
graph TB
    subgraph "Cookie 工作流程"
        A["1. 客户端首次请求"] --> B["2. 服务器设置 Set-Cookie"]
        B --> C["3. 浏览器保存 Cookie"]
        C --> D["4. 后续请求自动携带 Cookie"]
        D --> E["5. 服务器识别用户"]
    end
```

**Cookie 属性详解：**

| 属性 | 说明 | 示例 | 安全建议 |
|------|------|------|---------|
| Name | Cookie 名称 | session_id | 使用有意义的名称 |
| Value | Cookie 值 | abc123xyz | 使用随机、不可猜测的值 |
| Domain | 适用域名 | .example.com | 限制为最小域名范围 |
| Path | 适用路径 | /api | 限制为必要路径 |
| Expires | 过期时间 | Wed, 09 Jun 2024 10:18:14 GMT | 设置合理过期时间 |
| Max-Age | 最大存活秒数 | 3600 | 优先于 Expires |
| Secure | 仅 HTTPS 传输 | true | 生产环境必须开启 |
| HttpOnly | 禁止 JS 访问 | true | 防止 XSS 偷取 |
| SameSite | 跨站限制 | Strict/Lax/None | 防止 CSRF 攻击 |

**SameSite 属性详解：**

| 值 | 说明 | 跨站请求是否发送 |
|----|------|-----------------|
| Strict | 严格模式，完全禁止跨站发送 | ❌ 不发送 |
| Lax | 宽松模式，允许顶级导航的 GET 请求 | 部分发送 |
| None | 允许跨站发送（必须同时设置 Secure） | ✅ 发送 |

### Session 机制

```mermaid
graph TB
    subgraph "Session 存储方式"
        A["内存存储<br/>开发环境"]
        B["文件存储<br/>小型应用"]
        C["数据库存储<br/>MySQL/PostgreSQL"]
        D["Redis 存储<br/>生产环境推荐"]
    end

    subgraph "Session 的问题"
        E["服务器内存占用"]
        F["分布式环境同步"]
        G["水平扩展困难"]
    end

    C --> F
    D -->|"解决方案"| F
```

**Session vs Cookie 对比：**

| 对比维度 | Cookie | Session |
|---------|--------|---------|
| 存储位置 | 客户端（浏览器） | 服务器端 |
| 安全性 | 较低（可被篡改） | 较高（服务器控制） |
| 大小限制 | ~4KB | 理论上无限制 |
| 生命周期 | 可设置长期有效 | 通常浏览器关闭失效 |
| 服务器压力 | 无 | 需要存储空间 |
| 跨域 | 受 Domain/Path 限制 | 不涉及 |
| 性能 | 无服务器查询 | 需要查询存储 |

### JWT（JSON Web Token）替代方案

```mermaid
graph LR
    subgraph "JWT 结构"
        A["Header<br/>{alg, typ}"] --> B["." ]
        B --> C["Payload<br/>{sub, name, iat, exp}"]
        C --> D["." ]
        D --> E["Signature<br/>HMACSHA256(...)"]
    end
```

**JWT vs Session 对比：**

| 对比维度 | JWT | Session |
|---------|-----|---------|
| 存储位置 | 客户端 | 服务器 |
| 服务器状态 | 无状态 | 有状态 |
| 扩展性 | 天然支持分布式 | 需要共享存储 |
| 安全性 | 依赖签名算法 | 依赖服务器安全 |
| 注销 | 较难（需要黑名单） | 容易（删除 Session） |
| 数据大小 | 较大（包含用户信息） | 较小（只有 Session ID） |
| 性能 | 无需服务器查询 | 每次需要查询 |

```javascript
// JWT 示例（Node.js + jsonwebtoken）
const jwt = require('jsonwebtoken');

// 生成 Token
const token = jwt.sign(
    { userId: 123, username: 'zhangsan' },
    'your-secret-key',
    { expiresIn: '2h' }
);

// 验证 Token
try {
    const decoded = jwt.verify(token, 'your-secret-key');
    console.log(decoded); // { userId: 123, username: 'zhangsan', iat: ..., exp: ... }
} catch (err) {
    console.error('Token 无效:', err.message);
}

// Express 中间件
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: '未提供 Token' });
    }

    try {
        const decoded = jwt.verify(token, 'your-secret-key');
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token 无效或已过期' });
    }
};
```

---

# 第四章：HTTPS 与 TLS

## 4.1 为什么需要 HTTPS？

HTTP 是明文传输的，存在三大安全风险：

```mermaid
graph TB
    subgraph "HTTP 的安全风险"
        A["窃听风险<br/>第三方可以读取通信内容"] --> D["使用加密解决"]
        B["篡改风险<br/>第三方可以修改通信内容"] --> E["使用摘要解决"]
        C["冒充风险<br/>第三方可以伪装身份"] --> F["使用证书解决"]
    end

    D --> G["HTTPS"]
    E --> G
    F --> G
```

| 风险 | 说明 | 示例 | HTTPS 解决方案 |
|------|------|------|---------------|
| 窃听 | 第三方可以监听通信 | 公共 WiFi 抓包 | 对称加密 |
| 篡改 | 第三方可以修改数据 | 中间人修改响应 | 消息摘要（HMAC） |
| 冒充 | 第三方可以伪装服务器 | DNS 劫持、钓鱼网站 | 数字证书 |

## 4.2 加密技术基础

### 对称加密

```mermaid
graph LR
    A["明文"] -->|"密钥 K 加密"| B["密文"]
    B -->|"密钥 K 解密"| C["明文"]

    style A fill:#4CAF50,color:#fff
    style B fill:#FF9800,color:#fff
    style C fill:#4CAF50,color:#fff
```

**特点：** 加密和解密使用同一个密钥

| 算法 | 密钥长度 | 安全性 | 速度 | 用途 |
|------|---------|--------|------|------|
| AES-128 | 128 位 | 高 | 快 | 数据加密 |
| AES-256 | 256 位 | 很高 | 快 | 高安全场景 |
| ChaCha20 | 256 位 | 很高 | 很快 | 移动端优化 |
| DES | 56 位 | 低（已破解） | 快 | 已淘汰 |
| 3DES | 168 位 | 中 | 慢 | 逐步淘汰 |

**优点：** 速度快，适合大量数据加密
**缺点：** 密钥分发困难（如何安全地把密钥给对方？）

### 非对称加密

```mermaid
graph LR
    A["明文"] -->|"公钥加密"| B["密文"]
    B -->|"私钥解密"| C["明文"]

    D["明文"] -->|"私钥签名"| E["签名"]
    E -->|"公钥验证"| F["验证通过"]

    style A fill:#4CAF50,color:#fff
    style B fill:#FF9800,color:#fff
    style C fill:#4CAF50,color:#fff
    style D fill:#2196F3,color:#fff
    style E fill:#9C27B0,color:#fff
    style F fill:#4CAF50,color:#fff
```

**特点：** 使用一对密钥——公钥加密，私钥解密（或私钥签名，公钥验证）

| 算法 | 密钥长度 | 安全性 | 速度 | 用途 |
|------|---------|--------|------|------|
| RSA-2048 | 2048 位 | 高 | 慢 | 密钥交换、签名 |
| RSA-4096 | 4096 位 | 很高 | 很慢 | 高安全场景 |
| ECDSA-P256 | 256 位 | 高 | 快 | 签名 |
| Ed25519 | 256 位 | 很高 | 快 | 签名 |
| X25519 | 256 位 | 很高 | 快 | 密钥交换 |

**优点：** 解决了密钥分发问题
**缺点：** 速度慢，不适合大量数据加密

### 混合加密（TLS 的选择）

```mermaid
sequenceDiagram
    participant A as 发送方
    participant B as 接收方

    Note over A,B: 混合加密流程

    A->>B: 1. 请求公钥
    B->>A: 2. 返回公钥

    A->>A: 3. 生成随机会话密钥
    A->>A: 4. 使用会话密钥加密数据（对称加密）
    A->>B: 5. 使用公钥加密会话密钥（非对称加密）

    B->>B: 6. 使用私钥解密会话密钥
    B->>B: 7. 使用会话密钥解密数据
```

| 步骤 | 加密方式 | 操作 | 说明 |
|------|---------|------|------|
| 1 | 非对称加密 | 公钥加密会话密钥 | 安全传输密钥 |
| 2 | 对称加密 | 会话密钥加密数据 | 高效传输数据 |

## 4.3 TLS 握手流程

TLS（Transport Layer Security）是 HTTPS 的安全层，TLS 1.3 是当前最新版本。

### TLS 1.2 握手（完整版）

```mermaid
sequenceDiagram
    participant C as 客户端<br/>(Client)
    participant S as 服务器<br/>(Server)

    Note over C,S: TLS 1.2 握手过程（2-RTT）

    C->>S: 1. ClientHello<br/>- 支持的 TLS 版本<br/>- 支持的密码套件列表<br/>- 客户端随机数 (Client Random)<br/>- SNI (服务器名称)

    S->>C: 2. ServerHello<br/>- 选择的 TLS 版本<br/>- 选择的密码套件<br/>- 服务器随机数 (Server Random)

    S->>C: 3. Certificate<br/>- 服务器证书（公钥）

    S->>C: 4. ServerHelloDone<br/>- 服务器问候结束

    C->>C: 5. 验证证书<br/>- 检查证书链<br/>- 检查有效期<br/>- 检查吊销状态

    C->>C: 6. 生成预主密钥 (Pre-Master Secret)

    C->>S: 7. ClientKeyExchange<br/>- 使用服务器公钥加密预主密钥

    C->>C: 8. 计算主密钥<br/>主密钥 = PRF(预主密钥, Client Random, Server Random)

    C->>S: 9. ChangeCipherSpec<br/>- 通知切换到加密通信

    C->>S: 10. Finished<br/>- 验证握手完整性

    S->>C: 11. ChangeCipherSpec<br/>- 通知切换到加密通信

    S->>C: 12. Finished<br/>- 验证握手完整性

    Note over C,S: 握手完成，开始加密通信
```

### TLS 1.3 握手（优化版）

```mermaid
sequenceDiagram
    participant C as 客户端
    participant S as 服务器

    Note over C,S: TLS 1.3 握手过程（1-RTT）

    C->>S: 1. ClientHello<br/>- 支持的密码套件<br/>- 支持的密钥共享算法<br/>- 客户端密钥共享 (Key Share)<br/>- 客户端随机数

    S->>C: 2. ServerHello<br/>- 选择的密码套件<br/>- 服务器密钥共享 (Key Share)

    S->>C: 3. EncryptedExtensions<br/>- 加密的扩展信息

    S->>C: 4. Certificate<br/>- 加密的服务器证书

    S->>C: 5. CertificateVerify<br/>- 证书签名验证

    S->>C: 6. Finished

    C->>C: 7. 验证证书和签名

    C->>S: 8. Finished

    Note over C,S: 握手完成，开始加密通信

    Note over C,S: TLS 1.3 0-RTT 模式（恢复连接）

    C->>S: 0. ClientHello + Early Data<br/>- 预共享密钥 (PSK)<br/>- 早期应用数据
    S->>C: ServerHello + Finished + 响应数据
    Note over C,S: 连接立即恢复，无需等待
```

### TLS 1.2 vs TLS 1.3 对比

| 对比维度 | TLS 1.2 | TLS 1.3 |
|---------|---------|---------|
| 握手 RTT | 2-RTT | 1-RTT |
| 0-RTT 恢复 | 不支持 | 支持 |
| 密钥交换 | RSA, DHE, ECDHE | 仅 (EC)DHE |
| 对称加密 | AES-CBC, AES-GCM | 仅 AEAD（AES-GCM, ChaCha20） |
| 前向保密 | 可选 | 必须 |
| 密码套件数量 | 很多 | 仅 5 个 |
| 安全性 | 较高 | 更高 |
| 性能 | 较慢 | 更快 |

### 密码套件（Cipher Suite）

TLS 1.2 密码套件格式：
```
TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
│    │      │        │      │     │
│    │      │        │      │     └── 摘要算法
│    │      │        │      └── 加密模式
│    │      │        └── 对称加密算法
│    │      └── 身份验证算法
│    └── 密钥交换算法
└── 协议
```

| TLS 1.3 密码套件 | 密钥交换 | 对称加密 | 摘要 |
|-----------------|---------|---------|------|
| TLS_AES_128_GCM_SHA256 | ECDHE/ML-KEM | AES-128-GCM | SHA-256 |
| TLS_AES_256_GCM_SHA384 | ECDHE/ML-KEM | AES-256-GCM | SHA-384 |
| TLS_CHACHA20_POLY1305_SHA256 | ECDHE/ML-KEM | ChaCha20 | SHA-256 |

## 4.4 证书链验证

### 数字证书结构

```mermaid
graph TB
    subgraph "X.509 证书结构"
        V["版本<br/>Version"]
        SN["序列号<br/>Serial Number"]
        SI["签名算法<br/>Signature Algorithm"]
        I["颁发者<br/>Issuer"]
        VD["有效期<br/>Validity"]
        S["主体<br/>Subject"]
        PK["公钥<br/>Public Key"]
        E["扩展<br/>Extensions"]
        SG["签名<br/>Signature"]
    end

    V --> SN --> SI --> I --> VD --> S --> PK --> E --> SG
```

### 证书链验证过程

```mermaid
graph TB
    subgraph "证书链"
        Root["根证书<br/>(Root CA)<br/>自签名，预装在系统中"]
        Intermediate["中间证书<br/>(Intermediate CA)<br/>由根证书签发"]
        Server["服务器证书<br/>(End-entity)<br/>由中间证书签发"]
    end

    Root -->|"签发"| Intermediate
    Intermediate -->|"签发"| Server

    subgraph "验证过程"
        V1["1. 检查服务器证书签名"]
        V2["2. 验证中间证书"]
        V3["3. 验证根证书（信任锚点）"]
        V4["4. 检查有效期"]
        V5["5. 检查吊销状态"]
        V6["6. 检查域名匹配"]
    end

    Server --> V1 --> V2 --> V3 --> V4 --> V5 --> V6
```

**证书验证检查项：**

| 检查项 | 说明 | 失败结果 |
|--------|------|---------|
| 签名验证 | 确保证书未被篡改 | ERR_CERT_INVALID |
| 有效期 | 证书在有效期内 | ERR_CERT_DATE_INVALID |
| 域名匹配 | 证书域名与访问域名一致 | ERR_CERT_COMMON_NAME_INVALID |
| 吊销状态 | 证书未被吊销（CRL/OCSP） | ERR_CERT_REVOKED |
| 信任链 | 证书链可追溯到受信任的根证书 | ERR_CERT_AUTHORITY_INVALID |

### Let's Encrypt 免费证书

```bash
# 安装 certbot
sudo apt install certbot

# 获取证书（standalone 模式）
sudo certbot certonly --standalone -d example.com -d www.example.com

# 获取证书（nginx 模式）
sudo certbot --nginx -d example.com

# 证书文件位置
/etc/letsencrypt/live/example.com/
├── fullchain.pem    # 完整证书链
├── privkey.pem      # 私钥
├── cert.pem         # 服务器证书
└── chain.pem        # 中间证书

# 自动续期
sudo certbot renew --dry-run
```

## 4.5 HTTPS 配置最佳实践

```nginx
# Nginx HTTPS 配置
server {
    listen 443 ssl http2;
    server_name example.com;

    # 证书
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # TLS 版本
    ssl_protocols TLSv1.2 TLSv1.3;

    # 密码套件
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # 会话缓存
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;

    # 安全头部
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name example.com;
    return 301 https://$server_name$request_uri;
}
```

---

# 第五章：WebSocket 协议

## 5.1 WebSocket 概述

WebSocket 是一种在单个 TCP 连接上进行**全双工通信**的协议，解决了 HTTP 轮询的效率问题。

### HTTP 轮询 vs WebSocket

```mermaid
sequenceDiagram
    participant C as 客户端
    participant S as 服务器

    Note over C,S: HTTP 短轮询（效率低）

    loop 每隔 3 秒
        C->>S: GET /messages (有没有新消息？)
        S->>C: 没有
        C->>S: GET /messages (有没有新消息？)
        S->>C: 没有
        C->>S: GET /messages (有没有新消息？)
        S->>C: 有！这是新消息
    end

    Note over C,S: WebSocket（实时双向）

    C->>S: WebSocket 握手
    S->>C: 握手成功
    Note over C,S: 连接保持打开
    S-->>C: 推送新消息（服务器主动）
    C-->>S: 发送消息（客户端主动）
    S-->>C: 推送新消息
```

### 通信方式对比

| 方式 | 原理 | 延迟 | 服务器开销 | 实时性 | 适用场景 |
|------|------|------|-----------|--------|---------|
| 短轮询 | 定时请求 | 高（轮询间隔） | 高（频繁连接） | 差 | 极少使用 |
| 长轮询 | 保持请求直到有数据 | 中 | 中 | 一般 | 兼容性要求高 |
| SSE | 服务器单向推送 | 低 | 低 | 好 | 通知、数据流 |
| WebSocket | 全双工长连接 | 极低 | 低 | 极好 | 聊天、游戏、实时协作 |

## 5.2 WebSocket 握手过程

WebSocket 握手基于 HTTP 升级机制：

```mermaid
sequenceDiagram
    participant C as 客户端 (浏览器)
    participant S as 服务器

    Note over C,S: WebSocket 握手（HTTP 升级）

    C->>S: HTTP 请求（Upgrade: websocket）
    Note right of C: GET /chat HTTP/1.1<br/>Host: server.example.com<br/>Upgrade: websocket<br/>Connection: Upgrade<br/>Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==<br/>Sec-WebSocket-Version: 13<br/>Origin: http://example.com

    S->>C: HTTP 101 响应（协议切换）
    Note left of S: HTTP/1.1 101 Switching Protocols<br/>Upgrade: websocket<br/>Connection: Upgrade<br/>Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=

    Note over C,S: WebSocket 连接建立，开始全双工通信

    C-->>S: WebSocket 帧（文本/二进制）
    S-->>C: WebSocket 帧（文本/二进制）
    S-->>C: 服务器主动推送
    C-->>S: 客户端发送消息
```

**握手关键头部：**

| 头部 | 方向 | 说明 |
|------|------|------|
| Upgrade: websocket | 请求 | 请求升级为 WebSocket |
| Connection: Upgrade | 请求 | 连接需要升级 |
| Sec-WebSocket-Key | 请求 | 随机 Base64 编码的 16 字节值 |
| Sec-WebSocket-Version: 13 | 请求 | WebSocket 协议版本 |
| Sec-WebSocket-Accept | 响应 | 服务器确认（SHA-1 哈希） |
| Sec-WebSocket-Protocol | 双方 | 子协议（可选） |
| Sec-WebSocket-Extensions | 双方 | 扩展（如 permessage-deflate） |

**Sec-WebSocket-Accept 计算：**

```javascript
const crypto = require('crypto');

function computeAcceptKey(clientKey) {
    const GUID = '258EAFA5-E914-47DA-95CA-5AB9DC11B65E';
    return crypto
        .createHash('sha1')
        .update(clientKey + GUID)
        .digest('base64');
}

// 示例
const clientKey = 'dGhlIHNhbXBsZSBub25jZQ==';
const acceptKey = computeAcceptKey(clientKey);
console.log(acceptKey); // 's3pPLMBiTxaQ9kYGzzhZRbK+xOo='
```

## 5.3 WebSocket 帧格式

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-------+-+-------------+-------------------------------+
|F|R|R|R| opcode|M| Payload len |    Extended payload length    |
|I|S|S|S|  (4)  |A|     (7)     |            (16/64)            |
|N|V|V|V|       |S|             |   (if payload len==126/127)   |
| |1|2|3|       |K|             |                               |
+-+-+-+-+-------+-+-------------+-------------------------------+
|     Extended payload length continued, if payload len == 127  |
+-------------------------------+-------------------------------+
|                               |Masking-key, if MASK set to 1  |
+-------------------------------+-------------------------------+
| Masking-key (continued)       |          Payload Data         |
+-------------------------------+-------------------------------+
|                     Payload Data continued ...                 |
+---------------------------------------------------------------+
```

**帧头字段说明：**

| 字段 | 位数 | 说明 |
|------|------|------|
| FIN | 1 位 | 是否为最后一帧 |
| RSV1-3 | 各 1 位 | 保留位（扩展使用） |
| opcode | 4 位 | 帧类型 |
| MASK | 1 位 | 是否使用掩码（客户端必须） |
| Payload length | 7/7+16/7+64 位 | 载荷长度 |
| Masking-key | 0/32 位 | 掩码密钥 |

**Opcode 类型：**

| Opcode | 含义 | 说明 |
|--------|------|------|
| 0x0 | Continuation | 延续帧 |
| 0x1 | Text | 文本帧（UTF-8） |
| 0x2 | Binary | 二进制帧 |
| 0x3-0x7 | Reserved | 保留 |
| 0x8 | Close | 关闭帧 |
| 0x9 | Ping | Ping 帧 |
| 0xA | Pong | Pong 帧 |
| 0xB-0xF | Reserved | 保留 |

## 5.4 心跳机制

WebSocket 需要心跳来检测连接是否存活：

```mermaid
sequenceDiagram
    participant C as 客户端
    participant S as 服务器

    Note over C,S: WebSocket 心跳机制

    loop 每 30 秒
        C->>S: Ping 帧 (opcode: 0x9)
        S->>C: Pong 帧 (opcode: 0xA)
    end

    Note over C: 超过 60 秒未收到 Pong
    C->>C: 判定连接断开
    C->>C: 尝试重连

    Note over C,S: 服务器主动心跳

    loop 每 30 秒
        S->>C: Ping 帧
        C->>S: Pong 帧
    end
```

**心跳实现策略：**

| 策略 | 说明 | 适用场景 |
|------|------|---------|
| 固定间隔 | 每 N 秒发送一次 Ping | 一般应用 |
| 自适应 | 根据网络质量调整间隔 | 移动端应用 |
| 双向心跳 | 客户端和服务器都发 Ping | 高可靠场景 |
| 应用层心跳 | 发送普通消息代替 Ping | 业务消息兼心跳 |

## 5.5 关闭握手

```mermaid
sequenceDiagram
    participant C as 客户端
    participant S as 服务器

    Note over C,S: WebSocket 关闭握手

    C->>S: Close 帧 (opcode: 0x8)<br/>status: 1000 (正常关闭)<br/>reason: "任务完成"
    Note right of C: 状态: CLOSING

    S->>C: Close 帧 (opcode: 0x8)<br/>status: 1000 (正常关闭)
    Note left of S: 状态: CLOSING

    Note over C,S: TCP 连接关闭
    C->>S: TCP FIN
    S->>C: TCP FIN ACK
    C->>S: TCP ACK

    Note over C,S: 连接完全关闭
```

**关闭状态码：**

| 状态码 | 名称 | 说明 |
|--------|------|------|
| 1000 | Normal Closure | 正常关闭 |
| 1001 | Going Away | 终端离开（如页面关闭） |
| 1002 | Protocol Error | 协议错误 |
| 1003 | Unsupported Data | 不支持的数据类型 |
| 1005 | No Status Received | 未收到状态码 |
| 1006 | Abnormal Closure | 异常关闭（无 Close 帧） |
| 1007 | Invalid Frame Payload | 无效帧数据 |
| 1008 | Policy Violation | 策略违规 |
| 1009 | Message Too Big | 消息过大 |
| 1011 | Internal Error | 服务器内部错误 |
| 1012 | Service Restart | 服务器重启 |
| 1013 | Try Again Later | 稍后重试 |
| 3000-3999 | Registered | 注册使用 |
| 4000-4999 | Private | 私有使用 |

## 5.6 项目中的 WebSocket 实现分析

### 服务端实现（Node.js + ws）

```javascript
const WebSocket = require('ws');
const http = require('http');

// 创建 HTTP 服务器
const server = http.createServer();

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({
    server,
    path: '/ws',
    maxPayload: 10 * 1024 * 1024, // 10MB
    perMessageDeflate: {
        zlibDeflateOptions: {
            chunkSize: 1024,
            memLevel: 7,
            level: 3
        },
        zlibInflateOptions: {
            chunkSize: 10 * 1024
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 1024
    }
});

// 连接管理
const clients = new Map();

wss.on('connection', (ws, req) => {
    const clientId = generateClientId();
    const clientInfo = {
        ws,
        id: clientId,
        ip: req.socket.remoteAddress,
        connectedAt: Date.now(),
        lastPing: Date.now(),
        isAlive: true
    };

    clients.set(clientId, clientInfo);
    console.log(`客户端 ${clientId} 已连接 (IP: ${clientInfo.ip})`);

    // 发送欢迎消息
    ws.send(JSON.stringify({
        type: 'welcome',
        clientId,
        message: '连接成功'
    }));

    // 接收消息
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            handleMessage(clientId, message);
        } catch (err) {
            ws.send(JSON.stringify({
                type: 'error',
                message: '消息格式错误'
            }));
        }
    });

    // 处理 Pong（心跳响应）
    ws.on('pong', () => {
        clientInfo.isAlive = true;
        clientInfo.lastPing = Date.now();
    });

    // 连接关闭
    ws.on('close', (code, reason) => {
        console.log(`客户端 ${clientId} 断开: ${code} ${reason}`);
        clients.delete(clientId);
    });

    // 错误处理
    ws.on('error', (err) => {
        console.error(`客户端 ${clientId} 错误:`, err.message);
        clients.delete(clientId);
    });
});

// 消息处理
function handleMessage(clientId, message) {
    const client = clients.get(clientId);
    if (!client) return;

    switch (message.type) {
        case 'chat':
            // 广播聊天消息
            broadcast({
                type: 'chat',
                from: clientId,
                content: message.content,
                timestamp: Date.now()
            }, clientId);
            break;

        case 'private':
            // 私聊消息
            const target = clients.get(message.to);
            if (target && target.ws.readyState === WebSocket.OPEN) {
                target.ws.send(JSON.stringify({
                    type: 'private',
                    from: clientId,
                    content: message.content,
                    timestamp: Date.now()
                }));
            }
            break;

        case 'ping':
            // 应用层心跳
            client.ws.send(JSON.stringify({
                type: 'pong',
                timestamp: Date.now()
            }));
            break;

        default:
            client.ws.send(JSON.stringify({
                type: 'error',
                message: `未知消息类型: ${message.type}`
            }));
    }
}

// 广播消息
function broadcast(message, excludeId) {
    const data = JSON.stringify(message);
    clients.forEach((client, id) => {
        if (id !== excludeId && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(data);
        }
    });
}

// 心跳检测
const heartbeatInterval = setInterval(() => {
    clients.forEach((client, id) => {
        if (!client.isAlive) {
            console.log(`客户端 ${id} 心跳超时，断开连接`);
            client.ws.terminate();
            clients.delete(id);
            return;
        }
        client.isAlive = false;
        client.ws.ping();
    });
}, 30000);

// 优雅关闭
wss.on('close', () => {
    clearInterval(heartbeatInterval);
});

server.listen(8080, () => {
    console.log('WebSocket 服务器运行在 ws://localhost:8080/ws');
});
```

### 客户端实现（JavaScript）

```javascript
class WebSocketClient {
    constructor(url, options = {}) {
        this.url = url;
        this.options = {
            reconnectInterval: 3000,
            maxReconnectAttempts: 10,
            heartbeatInterval: 30000,
            heartbeatTimeout: 10000,
            ...options
        };

        this.ws = null;
        this.reconnectAttempts = 0;
        this.heartbeatTimer = null;
        this.heartbeatTimeout = null;
        this.isManualClose = false;
        this.listeners = new Map();

        this.connect();
    }

    // 建立连接
    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return;
        }

        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('WebSocket 连接成功');
            this.reconnectAttempts = 0;
            this.startHeartbeat();
            this.emit('open');
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.emit('message', data);
                if (data.type) {
                    this.emit(data.type, data);
                }
            } catch (err) {
                console.error('消息解析失败:', err);
            }
        };

        this.ws.onclose = (event) => {
            console.log(`连接关闭: ${event.code} ${event.reason}`);
            this.stopHeartbeat();
            this.emit('close', event);

            if (!this.isManualClose) {
                this.reconnect();
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket 错误:', error);
            this.emit('error', error);
        };
    }

    // 重连
    reconnect() {
        if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
            console.error('达到最大重连次数，停止重连');
            this.emit('reconnectFailed');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(
            this.options.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1),
            30000
        );

        console.log(`第 ${this.reconnectAttempts} 次重连，${delay}ms 后...`);
        this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

        setTimeout(() => this.connect(), delay);
    }

    // 心跳
    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            if (this.ws.readyState === WebSocket.OPEN) {
                this.send({ type: 'ping', timestamp: Date.now() });

                this.heartbeatTimeout = setTimeout(() => {
                    console.warn('心跳超时，关闭连接');
                    this.ws.close();
                }, this.options.heartbeatTimeout);
            }
        }, this.options.heartbeatInterval);
    }

    stopHeartbeat() {
        clearInterval(this.heartbeatTimer);
        clearTimeout(this.heartbeatTimeout);
    }

    // 发送消息
    send(data) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.warn('连接未就绪，消息未发送');
        }
    }

    // 关闭连接
    close(code = 1000, reason = '主动关闭') {
        this.isManualClose = true;
        this.stopHeartbeat();
        if (this.ws) {
            this.ws.close(code, reason);
        }
    }

    // 事件监听
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        return this; // 支持链式调用
    }

    emit(event, data) {
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach(cb => cb(data));
    }
}

// 使用示例
const client = new WebSocketClient('ws://localhost:8080/ws');

client
    .on('open', () => {
        client.send({ type: 'chat', content: '大家好！' });
    })
    .on('chat', (data) => {
        console.log(`[${data.from}]: ${data.content}`);
    })
    .on('reconnecting', (info) => {
        console.log(`正在重连... 第 ${info.attempt} 次`);
    })
    .on('close', () => {
        console.log('连接已关闭');
    });
```

### React Native 中的 WebSocket

```javascript
// React Native WebSocket Hook
import { useEffect, useRef, useState, useCallback } from 'react';

export function useWebSocket(url, options = {}) {
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState(null);
    const wsRef = useRef(null);
    const reconnectTimerRef = useRef(null);

    const connect = useCallback(() => {
        const ws = new WebSocket(url);

        ws.onopen = () => {
            setIsConnected(true);
            console.log('WebSocket 已连接');
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setLastMessage(data);
            } catch (err) {
                setLastMessage(event.data);
            }
        };

        ws.onclose = () => {
            setIsConnected(false);
            // 自动重连
            reconnectTimerRef.current = setTimeout(() => {
                connect();
            }, options.reconnectInterval || 3000);
        };

        ws.onerror = (error) => {
            console.error('WebSocket 错误:', error);
        };

        wsRef.current = ws;
    }, [url]);

    useEffect(() => {
        connect();

        return () => {
            clearTimeout(reconnectTimerRef.current);
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [connect]);

    const sendMessage = useCallback((data) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        }
    }, []);

    return { isConnected, lastMessage, sendMessage };
}

// 使用示例
function ChatScreen() {
    const { isConnected, lastMessage, sendMessage } = useWebSocket(
        'ws://localhost:8080/ws'
    );

    useEffect(() => {
        if (lastMessage) {
            console.log('收到消息:', lastMessage);
        }
    }, [lastMessage]);

    return (
        <View>
            <Text>连接状态: {isConnected ? '已连接' : '未连接'}</Text>
            <Button
                title="发送消息"
                onPress={() => sendMessage({ type: 'chat', content: 'Hello!' })}
            />
        </View>
    );
}
```

---

# 第六章：RESTful API 设计

## 6.1 REST 概述

REST（Representational State Transfer）是一种软件架构风格，由 Roy Fielding 在 2000 年的博士论文中提出。

### REST 核心概念

```mermaid
graph TB
    subgraph "REST 核心概念"
        A["资源 (Resource)<br/>一切皆资源"]
        B["表示 (Representation)<br/>资源的表现形式"]
        C["状态转移 (State Transfer)<br/>通过操作表示来改变状态"]
    end

    A -->|"URL 标识"| B
    B -->|"HTTP 方法操作"| C

    subgraph "示例"
        D["用户资源<br/>/api/users/123"]
        E["JSON 表示<br/>{name: '张三'}"]
        F["GET/PUT/DELETE<br/>获取/更新/删除"]
    end

    A -.-> D
    B -.-> E
    C -.-> F
```

## 6.2 REST 架构约束

```mermaid
graph TB
    subgraph "REST 六大约束"
        A["1. 客户端-服务器<br/>Client-Server"]
        B["2. 无状态<br/>Stateless"]
        C["3. 可缓存<br/>Cacheable"]
        D["4. 统一接口<br/>Uniform Interface"]
        E["5. 分层系统<br/>Layered System"]
        F["6. 按需代码<br/>(可选) Code on Demand"]
    end
```

| 约束 | 说明 | 实现方式 |
|------|------|---------|
| 客户端-服务器 | 关注点分离 | 前后端分离架构 |
| 无状态 | 每个请求包含所有信息 | Token、Session ID |
| 可缓存 | 响应可被缓存 | Cache-Control、ETag |
| 统一接口 | 标准化的操作方式 | HTTP 方法、URL、状态码 |
| 分层系统 | 客户端不知道中间层 | CDN、负载均衡、网关 |
| 按需代码 | 服务器可返回可执行代码 | JavaScript（可选） |

## 6.3 资源与 URL 设计

### URL 设计原则

```mermaid
graph LR
    subgraph "好的 URL 设计"
        A["/api/users"] --> B["/api/users/123"]
        B --> C["/api/users/123/orders"]
        C --> D["/api/users/123/orders/456"]
    end

    subgraph "坏的 URL 设计"
        E["/api/getUser"] 
        F["/api/user_list"]
        G["/api/deleteUser?id=123"]
        H["/api/USER/123"]
    end

    style A fill:#4CAF50,color:#fff
    style B fill:#4CAF50,color:#fff
    style C fill:#4CAF50,color:#fff
    style D fill:#4CAF50,color:#fff
    style E fill:#F44336,color:#fff
    style F fill:#F44336,color:#fff
    style G fill:#F44336,color:#fff
    style H fill:#F44336,color:#fff
```

### URL 设计规范

| 规则 | 正确 ✅ | 错误 ❌ | 说明 |
|------|---------|---------|------|
| 使用名词复数 | /api/users | /api/user | 资源用名词 |
| 使用小写 | /api/users | /api/Users | 统一小写 |
| 用连字符分隔 | /api/user-profiles | /api/user_profiles | 提高可读性 |
| 层级表示关系 | /api/users/123/orders | /api/orders?userId=123 | 体现资源关系 |
| 不要暴露实现 | /api/users/123 | /api/getUser.php?id=123 | 隐藏技术细节 |
| 版本号放在前面 | /api/v1/users | /api/users/v1 | 明确版本 |

### CRUD 操作映射

| 操作 | HTTP 方法 | URL | 状态码 |
|------|----------|-----|--------|
| 获取用户列表 | GET | /api/users | 200 OK |
| 获取单个用户 | GET | /api/users/123 | 200 OK |
| 创建用户 | POST | /api/users | 201 Created |
| 更新整个用户 | PUT | /api/users/123 | 200 OK |
| 部分更新用户 | PATCH | /api/users/123 | 200 OK |
| 删除用户 | DELETE | /api/users/123 | 204 No Content |

### 嵌套资源

```
# 用户的订单
GET    /api/users/123/orders          # 用户 123 的所有订单
POST   /api/users/123/orders          # 为用户 123 创建订单
GET    /api/users/123/orders/456      # 用户 123 的订单 456
PUT    /api/users/123/orders/456      # 更新订单 456
DELETE /api/users/123/orders/456      # 删除订单 456

# 订单的商品
GET    /api/users/123/orders/456/items
POST   /api/users/123/orders/456/items

# 建议：嵌套不要超过 3 层
# 深层资源可以直接访问
GET    /api/orders/456                # 直接获取订单
GET    /api/orders/456/items          # 获取订单商品
```

### 查询参数设计

```
# 分页
GET /api/users?page=1&limit=20

# 排序
GET /api/users?sort=created_at&order=desc
GET /api/users?sort=-created_at        # - 表示降序

# 过滤
GET /api/users?status=active&role=admin

# 字段选择
GET /api/users?fields=id,name,email

# 搜索
GET /api/users?q=张三

# 组合使用
GET /api/users?page=1&limit=20&sort=-created_at&status=active&fields=id,name,email
```

## 6.4 HATEOAS

HATEOAS（Hypermedia As The Engine Of Application State）是 REST 的最高成熟度级别。

```mermaid
graph LR
    subgraph "Richardson 成熟度模型"
        L0["Level 0<br/>使用 HTTP"]
        L1["Level 1<br/>资源"]
        L2["Level 2<br/>HTTP 方法"]
        L3["Level 3<br/>HATEOAS"]
    end

    L0 --> L1 --> L2 --> L3
```

| 级别 | 说明 | 示例 |
|------|------|------|
| Level 0 | 使用 HTTP 传输 | POST /api → 所有操作 |
| Level 1 | 引入资源概念 | POST /api/users, POST /api/orders |
| Level 2 | 使用 HTTP 方法 | GET /api/users, POST /api/users |
| Level 3 | HATEOAS | 响应包含操作链接 |

### HATEOAS 响应示例

```json
{
    "data": {
        "id": 123,
        "name": "张三",
        "email": "zhangsan@example.com"
    },
    "links": {
        "self": {
            "href": "/api/users/123",
            "method": "GET"
        },
        "update": {
            "href": "/api/users/123",
            "method": "PUT"
        },
        "delete": {
            "href": "/api/users/123",
            "method": "DELETE"
        },
        "orders": {
            "href": "/api/users/123/orders",
            "method": "GET"
        }
    },
    "actions": [
        {
            "name": "change-email",
            "href": "/api/users/123/email",
            "method": "PATCH",
            "fields": [
                { "name": "email", "type": "string", "required": true }
            ]
        }
    ]
}
```

## 6.5 API 版本管理

### 版本管理策略

| 方式 | 示例 | 优点 | 缺点 |
|------|------|------|------|
| URL 路径 | /api/v1/users | 直观、易于路由 | URL 变长 |
| 请求头 | Accept: application/vnd.api+json;version=1 | URL 干净 | 不直观 |
| 查询参数 | /api/users?version=1 | 简单 | 不够专业 |
| 域名 | v1.api.example.com | 完全隔离 | 域名管理复杂 |

### 版本管理最佳实践

```javascript
// Express 版本路由示例
const express = require('express');
const app = express();

// v1 路由
const v1Router = express.Router();
v1Router.get('/users', (req, res) => {
    res.json({
        version: 'v1',
        data: [
            { id: 1, name: '张三' },
            { id: 2, name: '李四' }
        ]
    });
});

// v2 路由
const v2Router = express.Router();
v2Router.get('/users', (req, res) => {
    res.json({
        version: 'v2',
        data: [
            { id: 1, name: '张三', avatar: 'https://...' },
            { id: 2, name: '李四', avatar: 'https://...' }
        ],
        pagination: {
            page: 1,
            limit: 20,
            total: 2
        }
    });
});

app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);
```

### API 响应格式规范

```json
// 成功响应
{
    "code": 200,
    "message": "success",
    "data": {
        "id": 123,
        "name": "张三"
    },
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "req-uuid-12345"
}

// 列表响应
{
    "code": 200,
    "message": "success",
    "data": {
        "items": [...],
        "pagination": {
            "page": 1,
            "limit": 20,
            "total": 100,
            "totalPages": 5
        }
    }
}

// 错误响应
{
    "code": 400,
    "message": "参数验证失败",
    "errors": [
        {
            "field": "email",
            "message": "邮箱格式不正确"
        },
        {
            "field": "password",
            "message": "密码长度不能少于 8 位"
        }
    ],
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "req-uuid-12345"
}
```

---

# 第七章：gRPC 与 GraphQL

## 7.1 gRPC 概述

gRPC 是 Google 开发的高性能 RPC（远程过程调用）框架，使用 Protocol Buffers 作为序列化格式。

### gRPC vs REST 对比

```mermaid
graph TB
    subgraph "gRPC"
        G1["Protocol Buffers<br/>二进制序列化"]
        G2["HTTP/2<br/>多路复用、流式"]
        G3["强类型<br/>接口定义明确"]
        G4["代码生成<br/>自动生成客户端"]
    end

    subgraph "REST"
        R1["JSON<br/>文本序列化"]
        R2["HTTP/1.1 或 HTTP/2"]
        R3["弱类型<br/>依赖文档"]
        R4["手动实现<br/>或生成 SDK"]
    end
```

| 对比维度 | gRPC | REST |
|---------|------|------|
| 序列化格式 | Protocol Buffers（二进制） | JSON（文本） |
| 传输协议 | HTTP/2 | HTTP/1.1 或 HTTP/2 |
| 接口定义 | .proto 文件 | OpenAPI/Swagger |
| 代码生成 | 自动生成 | 可选 |
| 性能 | 高（二进制、HTTP/2） | 一般（文本解析） |
| 流式传输 | 支持（4 种模式） | 不原生支持 |
| 浏览器支持 | 需要 gRPC-Web | 原生支持 |
| 学习曲线 | 较高 | 较低 |
| 生态系统 | 较新 | 非常成熟 |

## 7.2 Protocol Buffers（Protobuf）

### .proto 文件定义

```protobuf
syntax = "proto3";

package user;

option go_package = "github.com/example/user";

// 用户服务定义
service UserService {
    // 获取用户
    rpc GetUser(GetUserRequest) returns (User);

    // 创建用户
    rpc CreateUser(CreateUserRequest) returns (User);

    // 用户列表（服务端流式）
    rpc ListUsers(ListUsersRequest) returns (stream User);

    // 批量创建（客户端流式）
    rpc BatchCreateUsers(stream CreateUserRequest) returns (BatchCreateResponse);

    // 实时聊天（双向流式）
    rpc Chat(stream ChatMessage) returns (stream ChatMessage);
}

// 消息定义
message User {
    int32 id = 1;
    string name = 2;
    string email = 3;
    UserStatus status = 4;
    google.protobuf.Timestamp created_at = 5;
    repeated string roles = 6;
    map<string, string> metadata = 7;
}

message GetUserRequest {
    int32 id = 1;
}

message CreateUserRequest {
    string name = 1;
    string email = 2;
    string password = 3;
}

message ListUsersRequest {
    int32 page = 1;
    int32 page_size = 2;
    string status = 3;
}

message BatchCreateResponse {
    int32 success_count = 1;
    int32 failure_count = 2;
    repeated string errors = 3;
}

message ChatMessage {
    string user_id = 1;
    string content = 2;
    google.protobuf.Timestamp timestamp = 3;
}

enum UserStatus {
    USER_STATUS_UNSPECIFIED = 0;
    USER_STATUS_ACTIVE = 1;
    USER_STATUS_INACTIVE = 2;
    USER_STATUS_BANNED = 3;
}
```

### gRPC 四种通信模式

```mermaid
sequenceDiagram
    participant C as 客户端
    participant S as 服务器

    Note over C,S: 1. Unary（一元）- 类似 REST

    C->>S: 请求
    S->>C: 响应

    Note over C,S: 2. Server Streaming（服务端流式）

    C->>S: 请求
    S-->>C: 响应流 1
    S-->>C: 响应流 2
    S-->>C: 响应流 3
    S-->>C: 响应结束

    Note over C,S: 3. Client Streaming（客户端流式）

    C-->>S: 请求流 1
    C-->>S: 请求流 2
    C-->>S: 请求流 3
    C-->>S: 请求结束
    S->>C: 响应

    Note over C,S: 4. Bidirectional Streaming（双向流式）

    C-->>S: 请求流 1
    S-->>C: 响应流 1
    C-->>S: 请求流 2
    S-->>C: 响应流 2
    C-->>S: 请求流 3
    S-->>C: 响应流 3
```

### gRPC 服务端实现（Node.js）

```javascript
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

// 加载 proto 文件
const packageDefinition = protoLoader.loadSync('user.proto', {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});

const userProto = grpc.loadPackageDefinition(packageDefinition).user;

// 实现服务
const userService = {
    // 一元调用
    GetUser: (call, callback) => {
        const { id } = call.request;
        // 查找用户
        const user = users.find(u => u.id === id);
        if (user) {
            callback(null, user);
        } else {
            callback({
                code: grpc.status.NOT_FOUND,
                message: `用户 ${id} 不存在`
            });
        }
    },

    // 创建用户
    CreateUser: (call, callback) => {
        const { name, email } = call.request;
        const user = {
            id: users.length + 1,
            name,
            email,
            status: 'USER_STATUS_ACTIVE',
            created_at: new Date().toISOString()
        };
        users.push(user);
        callback(null, user);
    },

    // 服务端流式
    ListUsers: (call) => {
        const { page, page_size } = call.request;
        const start = (page - 1) * page_size;
        const end = start + page_size;

        users.slice(start, end).forEach(user => {
            call.write(user);
        });

        call.end();
    },

    // 客户端流式
    BatchCreateUsers: (call, callback) => {
        let successCount = 0;
        let failureCount = 0;
        const errors = [];

        call.on('data', (request) => {
            try {
                users.push({
                    id: users.length + 1,
                    ...request,
                    status: 'USER_STATUS_ACTIVE'
                });
                successCount++;
            } catch (err) {
                failureCount++;
                errors.push(err.message);
            }
        });

        call.on('end', () => {
            callback(null, {
                success_count: successCount,
                failure_count: failureCount,
                errors
            });
        });
    },

    // 双向流式
    Chat: (call) => {
        call.on('data', (message) => {
            // 广播消息给其他客户端
            call.write({
                user_id: 'server',
                content: `收到: ${message.content}`,
                timestamp: new Date().toISOString()
            });
        });

        call.on('end', () => {
            call.end();
        });
    }
};

// 启动服务器
const server = new grpc.Server();
server.addService(userProto.UserService.service, userService);

server.bindAsync(
    '0.0.0.0:50051',
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
        if (err) {
            console.error('服务器启动失败:', err);
            return;
        }
        console.log(`gRPC 服务器运行在端口 ${port}`);
    }
);
```

## 7.3 GraphQL

### GraphQL 概述

GraphQL 是 Facebook 开发的查询语言，允许客户端精确指定需要的数据。

### GraphQL vs REST 对比

```mermaid
graph TB
    subgraph "REST 的问题"
        A["过度获取<br/>Over-fetching"]
        B["不足获取<br/>Under-fetching"]
        C["多个请求"]
    end

    subgraph "GraphQL 的优势"
        D["精确获取<br/>按需查询"]
        E["一次请求<br/>获取所有数据"]
        F["强类型系统"]
    end

    A --> D
    B --> E
    C --> E
```

| 对比维度 | REST | GraphQL |
|---------|------|---------|
| 数据获取 | 固定结构 | 按需查询 |
| 端点数量 | 多个端点 | 单一端点 |
| 请求次数 | 可能多次 | 通常一次 |
| 版本管理 | URL 版本 | 字段弃用 |
| 缓存 | HTTP 缓存 | 需要额外方案 |
| 学习曲线 | 低 | 中 |
| 工具生态 | 成熟 | 快速发展 |

### GraphQL Schema 定义

```graphql
# 类型定义
type User {
    id: ID!
    name: String!
    email: String!
    avatar: String
    status: UserStatus!
    posts: [Post!]!
    followers: [User!]!
    createdAt: DateTime!
}

type Post {
    id: ID!
    title: String!
    content: String!
    author: User!
    comments: [Comment!]!
    tags: [String!]!
    createdAt: DateTime!
}

type Comment {
    id: ID!
    content: String!
    author: User!
    post: Post!
    createdAt: DateTime!
}

enum UserStatus {
    ACTIVE
    INACTIVE
    BANNED
}

# 查询类型
type Query {
    # 获取单个用户
    user(id: ID!): User

    # 用户列表
    users(
        page: Int = 1
        limit: Int = 20
        status: UserStatus
        search: String
    ): UserConnection!

    # 获取单篇文章
    post(id: ID!): Post

    # 文章列表
    posts(
        page: Int = 1
        limit: Int = 20
        tag: String
    ): PostConnection!

    # 当前用户
    me: User
}

# 变更类型
type Mutation {
    # 创建用户
    createUser(input: CreateUserInput!): User!

    # 更新用户
    updateUser(id: ID!, input: UpdateUserInput!): User!

    # 删除用户
    deleteUser(id: ID!): Boolean!

    # 创建文章
    createPost(input: CreatePostInput!): Post!

    # 添加评论
    addComment(postId: ID!, input: AddCommentInput!): Comment!
}

# 订阅类型
type Subscription {
    # 新文章订阅
    postCreated: Post!

    # 新评论订阅
    commentAdded(postId: ID!): Comment!
}

# 输入类型
input CreateUserInput {
    name: String!
    email: String!
    password: String!
}

input UpdateUserInput {
    name: String
    email: String
    avatar: String
}

input CreatePostInput {
    title: String!
    content: String!
    tags: [String!]
}

input AddCommentInput {
    content: String!
}

# 连接类型（分页）
type UserConnection {
    items: [User!]!
    pageInfo: PageInfo!
    totalCount: Int!
}

type PostConnection {
    items: [Post!]!
    pageInfo: PageInfo!
    totalCount: Int!
}

type PageInfo {
    page: Int!
    limit: Int!
    totalPages: Int!
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
}

# 自定义标量
scalar DateTime
scalar JSON
```

### GraphQL 查询示例

```graphql
# 查询用户及其文章（精确获取需要的字段）
query GetUserWithPosts {
    user(id: "123") {
        id
        name
        email
        avatar
        posts(limit: 5) {
            items {
                id
                title
                createdAt
                comments {
                    id
                    content
                    author {
                        name
                    }
                }
            }
        }
    }
}

# 使用变量的查询
query SearchUsers($search: String!, $page: Int) {
    users(search: $search, page: $page, limit: 10) {
        items {
            id
            name
            email
            status
        }
        pageInfo {
            page
            totalPages
            hasNextPage
        }
        totalCount
    }
}

# 创建用户
mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
        id
        name
        email
        createdAt
    }
}

# 订阅新评论
subscription OnNewComment($postId: ID!) {
    commentAdded(postId: $postId) {
        id
        content
        author {
            id
            name
            avatar
        }
        createdAt
    }
}
```

### GraphQL 服务端实现（Node.js + Apollo Server）

```javascript
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/lib/use/ws');
const express = require('express');
const http = require('http');

// Schema 定义
const typeDefs = `
    type User {
        id: ID!
        name: String!
        email: String!
        posts: [Post!]!
    }

    type Post {
        id: ID!
        title: String!
        content: String!
        author: User!
    }

    type Query {
        user(id: ID!): User
        users: [User!]!
    }

    type Mutation {
        createUser(name: String!, email: String!): User!
    }
`;

// 数据源
const users = [
    { id: '1', name: '张三', email: 'zhangsan@example.com' },
    { id: '2', name: '李四', email: 'lisi@example.com' }
];

const posts = [
    { id: '1', title: 'GraphQL 入门', content: '...', authorId: '1' },
    { id: '2', title: 'REST vs GraphQL', content: '...', authorId: '2' }
];

// Resolver
const resolvers = {
    Query: {
        user: (_, { id }) => users.find(u => u.id === id),
        users: () => users
    },
    Mutation: {
        createUser: (_, { name, email }) => {
            const user = {
                id: String(users.length + 1),
                name,
                email
            };
            users.push(user);
            return user;
        }
    },
    User: {
        posts: (parent) => posts.filter(p => p.authorId === parent.id)
    },
    Post: {
        author: (parent) => users.find(u => u.id === parent.authorId)
    }
};

// 创建服务器
async function startServer() {
    const app = express();
    const httpServer = http.createServer(app);

    const schema = makeExecutableSchema({ typeDefs, resolvers });

    // WebSocket 服务器（用于订阅）
    const wsServer = new WebSocketServer({
        server: httpServer,
        path: '/graphql'
    });
    useServer({ schema }, wsServer);

    // Apollo Server
    const server = new ApolloServer({ schema });
    await server.start();

    app.use('/graphql', express.json(), expressMiddleware(server));

    httpServer.listen(4000, () => {
        console.log('GraphQL 服务器运行在 http://localhost:4000/graphql');
    });
}

startServer();
```

### GraphQL 客户端使用

```javascript
// 使用 fetch
async function queryGraphQL(query, variables = {}) {
    const response = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer your-token'
        },
        body: JSON.stringify({ query, variables })
    });

    const result = await response.json();

    if (result.errors) {
        throw new Error(result.errors[0].message);
    }

    return result.data;
}

// 使用示例
const data = await queryGraphQL(`
    query GetUser($id: ID!) {
        user(id: $id) {
            id
            name
            email
            posts {
                id
                title
            }
        }
    }
`, { id: '1' });

console.log(data.user);

// 使用 Apollo Client（React）
import { ApolloClient, InMemoryCache, gql, useQuery } from '@apollo/client';

const client = new ApolloClient({
    uri: 'http://localhost:4000/graphql',
    cache: new InMemoryCache()
});

const GET_USERS = gql`
    query GetUsers {
        users {
            id
            name
            email
        }
    }
`;

function UserList() {
    const { loading, error, data } = useQuery(GET_USERS);

    if (loading) return <p>加载中...</p>;
    if (error) return <p>错误: {error.message}</p>;

    return (
        <ul>
            {data.users.map(user => (
                <li key={user.id}>{user.name} ({user.email})</li>
            ))}
        </ul>
    );
}
```

## 7.4 三种 API 风格对比

| 对比维度 | REST | GraphQL | gRPC |
|---------|------|---------|------|
| 数据格式 | JSON | JSON | Protobuf（二进制） |
| 传输协议 | HTTP/1.1+ | HTTP/1.1+ | HTTP/2 |
| 接口定义 | OpenAPI | Schema | .proto |
| 性能 | 一般 | 一般 | 高 |
| 浏览器支持 | ✅ 原生 | ✅ 原生 | ❌ 需要 gRPC-Web |
| 流式传输 | ❌ | ✅ 订阅 | ✅ 四种模式 |
| 代码生成 | 可选 | 可选 | 必须 |
| 缓存 | ✅ HTTP 缓存 | ❌ 需要额外方案 | ❌ |
| 文件上传 | ✅ multipart | ❌ 需要额外方案 | ✅ 流式 |
| 学习曲线 | 低 | 中 | 高 |
| 适用场景 | 通用 Web API | 移动端、复杂查询 | 微服务内部通信 |

---

# 第八章：网络调试工具

## 8.1 curl 使用指南

curl 是最强大的命令行 HTTP 工具。

### 基本请求

```bash
# GET 请求
curl https://api.example.com/users

# POST 请求（JSON）
curl -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -d '{"name": "张三", "email": "zhangsan@example.com"}'

# PUT 请求
curl -X PUT https://api.example.com/users/123 \
  -H "Content-Type: application/json" \
  -d '{"name": "张三丰"}'

# PATCH 请求
curl -X PATCH https://api.example.com/users/123 \
  -H "Content-Type: application/json" \
  -d '{"email": "new@example.com"}'

# DELETE 请求
curl -X DELETE https://api.example.com/users/123
```

### 常用选项

| 选项 | 说明 | 示例 |
|------|------|------|
| -X | 指定方法 | -X POST |
| -H | 添加请求头 | -H "Authorization: Bearer xxx" |
| -d | 发送数据 | -d '{"key":"value"}' |
| -o | 输出到文件 | -o file.txt |
| -O | 使用远程文件名保存 | -O |
| -s | 静默模式 | -s |
| -S | 显示错误 | -sS |
| -v | 详细输出 | -v |
| -I | 只显示头部 | -I |
| -L | 跟随重定向 | -L |
| -k | 忽略 SSL 错误 | -k |
| -u | 认证信息 | -u user:pass |
| -b | Cookie | -b "session=abc" |
| -c | 保存 Cookie | -c cookies.txt |
| -A | User-Agent | -A "MyApp/1.0" |
| -e | Referer | -e "https://example.com" |
| -x | 代理 | -x http://proxy:8080 |
| --compressed | 压缩 | --compressed |

### 高级用法

```bash
# 1. 文件上传
curl -X POST https://api.example.com/upload \
  -F "file=@/path/to/file.jpg" \
  -F "description=My photo"

# 2. 多文件上传
curl -X POST https://api.example.com/upload \
  -F "files[]=@file1.jpg" \
  -F "files[]=@file2.jpg"

# 3. 下载文件（带进度条）
curl -L -O https://example.com/file.zip

# 4. 断点续传
curl -C - -O https://example.com/large-file.zip

# 5. 限速下载
curl --limit-rate 100K -O https://example.com/file.zip

# 6. 设置超时
curl --connect-timeout 5 --max-time 30 https://api.example.com

# 7. 查看详细请求/响应
curl -v https://api.example.com/users

# 8. 只查看响应头
curl -I https://api.example.com

# 9. 发送 Cookie
curl -b "session=abc123; token=xyz" https://api.example.com/me

# 10. 保存和使用 Cookie
curl -c cookies.txt -d "user=admin&pass=123" https://api.example.com/login
curl -b cookies.txt https://api.example.com/me

# 11. 使用代理
curl -x http://proxy.example.com:8080 https://api.example.com

# 12. SOCKS5 代理
curl --socks5-hostname localhost:1080 https://api.example.com

# 13. 自定义 DNS
curl --resolve api.example.com:443:1.2.3.4 https://api.example.com

# 14. 并发请求（curl 7.66+）
curl --parallel --parallel-max 5 \
  https://api.example.com/users/1 \
  https://api.example.com/users/2 \
  https://api.example.com/users/3

# 15. JSON 格式化输出
curl -s https://api.example.com/users | jq '.'

# 16. 使用环境变量
export TOKEN="your-jwt-token"
curl -H "Authorization: Bearer $TOKEN" https://api.example.com/me
```

### curl 调试技巧

```bash
# 查看完整的请求和响应（包括 TLS 握手）
curl -v --trace-time https://api.example.com

# 输出到文件同时显示进度
curl -o output.json https://api.example.com/data

# 查看 TLS 证书信息
curl -vI https://api.example.com 2>&1 | grep -E "(subject|expire|issuer)"

# 测试 HTTP/2
curl --http2 -I https://api.example.com

# 测试特定 HTTP 版本
curl --http1.0 https://api.example.com
curl --http1.1 https://api.example.com
curl --http2 https://api.example.com

# 保存完整会话（请求和响应）
curl -v https://api.example.com 2>&1 | tee session.log
```

## 8.2 Wireshark 抓包

### Wireshark 基础

```mermaid
graph TB
    subgraph "Wireshark 工作流程"
        A["选择网卡"] --> B["开始捕获"]
        B --> C["应用显示过滤器"]
        C --> D["分析数据包"]
        D --> E["跟踪流"]
        E --> F["导出结果"]
    end
```

### 常用显示过滤器

| 过滤器 | 说明 | 示例 |
|--------|------|------|
| http | HTTP 协议 | http |
| tcp | TCP 协议 | tcp |
| udp | UDP 协议 | udp |
| dns | DNS 查询 | dns |
| ip.addr == | IP 地址 | ip.addr == 192.168.1.1 |
| tcp.port == | TCP 端口 | tcp.port == 80 |
| http.host == | HTTP 主机 | http.host == example.com |
| http.request.method == | HTTP 方法 | http.request.method == POST |
| http.response.code == | 状态码 | http.response.code == 200 |
| tcp.flags.syn == 1 | SYN 包 | tcp.flags.syn == 1 |
| tcp.flags.fin == 1 | FIN 包 | tcp.flags.fin == 1 |

### 过滤器组合

```bash
# HTTP GET 请求到特定主机
http.request.method == "GET" && http.host == "api.example.com"

# 特定 IP 的 HTTP 流量
ip.addr == 10.0.0.1 && http

# 错误响应
http.response.code >= 400

# 特定端口的 TCP 流量
tcp.port == 443

# DNS 查询
dns.qry.name contains "example"

# WebSocket 流量
websocket

# TLS 握手
tls.handshake

# 特定时间段
frame.time >= "2024-01-01 00:00:00" && frame.time <= "2024-01-01 23:59:59"
```

### TCP 流跟踪

```bash
# 在 Wireshark 中：
# 1. 右键点击一个 TCP 包
# 2. 选择 "Follow" → "TCP Stream"
# 3. 查看完整的 TCP 会话

# 使用 tshark 命令行
tshark -r capture.pcap -z "follow,tcp,ascii,0"
```

### Wireshark 分析 HTTP 请求

```bash
# 统计 HTTP 请求
tshark -r capture.pcap -z "http,tree"

# 查看所有 HTTP 请求
tshark -r capture.pcap -Y "http.request" -T fields \
  -e http.request.method \
  -e http.host \
  -e http.request.uri

# 查看所有 HTTP 响应
tshark -r capture.pcap -Y "http.response" -T fields \
  -e http.response.code \
  -e http.content_type
```

## 8.3 Chrome DevTools Network 面板

### Network 面板功能

```mermaid
graph TB
    subgraph "Chrome DevTools Network"
        A["Preserve Log<br/>保留跨页面日志"]
        B["Disable Cache<br/>禁用缓存"]
        C["Throttling<br/>网络限速"]
        D["过滤器<br/>XHR/JS/CSS/Img"]
        E["请求列表<br/>时序、大小、状态"]
        F["请求详情<br/>Headers/Preview/Response"]
    end
```

### Network 面板详解

| 标签页 | 说明 | 用途 |
|--------|------|------|
| Headers | 请求/响应头 | 查看完整的头部信息 |
| Preview | 预览响应 | 查看 JSON、图片等 |
| Response | 原始响应 | 查看完整响应体 |
| Initiator | 请求发起者 | 追踪请求来源 |
| Timing | 时间详情 | 分析性能瓶颈 |
| Cookies | Cookie 信息 | 查看发送的 Cookie |
| WebSocket | WebSocket 帧 | 查看 WebSocket 消息 |
---

# 补充章节：HTTP/2 与 HTTP/3

> 📖 本节详解 HTTP 协议的最新版本，帮你理解现代 Web 的通信基础。

## HTTP/2 核心特性

### 多路复用（Multiplexing）

HTTP/1.1 的最大问题是**队头阻塞**（Head-of-Line Blocking）——同一个连接上的请求必须排队。

```mermaid
graph LR
    subgraph "HTTP/1.1"
        R1["请求1"] -->|"等待"| R2["请求2"] -->|"等待"| R3["请求3"]
    end

    subgraph "HTTP/2"
        S1["请求1"] ~~~ S2["请求2"]
        S2 ~~~ S3["请求3"]
        S1 --> P["同一个 TCP 连接<br/>交错传输"]
        S2 --> P
        S3 --> P
    end

    style R1 fill:#f44336,color:#fff
    style R2 fill:#f44336,color:#fff
    style R3 fill:#f44336,color:#fff
    style P fill:#4CAF50,color:#fff
```

### 头部压缩（HPACK）

HTTP/1.1 的请求头是纯文本，每次请求都重复发送大量相同的头部（如 Cookie、User-Agent）。HTTP/2 使用 HPACK 算法压缩头部：

```mermaid
graph TD
    A["请求头<br/>Cookie: session=abc123<br/>User-Agent: Mozilla/5.0<br/>Accept: text/html"] --> B["HPACK 编码"]
    B --> C["静态表匹配<br/>（61个预定义常用头部）"]
    B --> D["动态表<br/>（已发送的头部缓存）"]
    B --> E["霍夫曼编码<br/>（压缩值）"]
    C --> F["压缩后的二进制帧"]
    D --> F
    E --> F

    style F fill:#4CAF50,color:#fff
```

### 服务器推送（Server Push）

服务器可以在客户端请求之前，主动推送资源：

```mermaid
sequenceDiagram
    participant C as 📱 客户端
    participant S as 🖥️ 服务端

    C->>S: GET /index.html
    S-->>C: index.html
    Note over S: 预判需要 style.css 和 app.js
    S-->>C: PUSH_PROMISE /style.css
    S-->>C: PUSH_PROMISE /app.js
    C->>S: 需要 style.css（已经在缓存中了！）
    C->>S: 需要 app.js（已经在缓存中了！）
```

## HTTP/3 与 QUIC

HTTP/3 彻底弃用 TCP，改用基于 UDP 的 QUIC 协议：

```mermaid
graph TB
    subgraph "HTTP/2（基于 TCP）"
        A["应用层：HTTP/2"]
        B["传输层：TCP"]
        C["网络层：IP"]
        A --> B --> C
    end

    subgraph "HTTP/3（基于 QUIC/UDP）"
        D["应用层：HTTP/3"]
        E["QUIC（内置 TLS 1.3）"]
        F["传输层：UDP"]
        G["网络层：IP"]
        D --> E --> F --> G
    end

    style A fill:#2196F3,color:#fff
    style D fill:#4CAF50,color:#fff
```

| 特性 | HTTP/2 (TCP) | HTTP/3 (QUIC) |
|------|-------------|---------------|
| 队头阻塞 | TCP 层仍然阻塞 | 完全消除 |
| 连接建立 | TCP 3次握手 + TLS 1-2次 | 0-RTT 或 1-RTT |
| 连接迁移 | IP 变化需要重建连接 | Connection ID 无缝迁移 |
| 加密 | 可选 TLS | 强制 TLS 1.3 |

---

# 补充章节：HTTP 缓存策略

> 📖 本节详解浏览器缓存机制，帮你理解如何让网页加载更快。

## 缓存决策流程

```mermaid
graph TD
    A["浏览器发起请求"] --> B{"有缓存?"}
    B -->|"没有"| C["向服务器请求"]
    B -->|"有"| D{"Cache-Control<br/>或 Expires 有效?"}
    D -->|"有效"| E["强缓存命中<br/>直接使用缓存 ✅<br/>状态码 200 (from cache)"]
    D -->|"过期"| F{"发送条件请求<br/>If-None-Match / If-Modified-Since"}
    F --> G{"服务器返回 304?"}
    G -->|"是"| H["协商缓存命中<br/>使用缓存 ✅"]
    G -->|"否（200）"| I["返回新资源"]

    style E fill:#4CAF50,color:#fff
    style H fill:#2196F3,color:#fff
    style I fill:#FF9800,color:#fff
```

### 强缓存 vs 协商缓存

| 类型 | 头部字段 | 状态码 | 特点 |
|------|---------|--------|------|
| 强缓存 | `Cache-Control: max-age=3600` | 200 (from cache) | 不发请求，直接用缓存 |
| 协商缓存 | `ETag` + `If-None-Match` | 304 Not Modified | 发请求验证，不下载资源 |

---

> 📝 补充章节完成。

---

# 补充章节：REST vs GraphQL vs gRPC

> 📖 本节对比三种主流 API 架构风格，帮你理解各自的适用场景。

## 三种架构风格对比

```mermaid
graph LR
    subgraph "REST"
        R1["GET /users/1"] --> R2["返回完整用户对象"]
        R3["GET /users/1/posts"] --> R4["返回所有帖子"]
    end

    subgraph "GraphQL"
        G1["query { user(id:1) { name posts { title } } }"] --> G2["只返回需要的字段"]
    end

    subgraph "gRPC"
        GR1["UserService.GetUser(id)"] --> GR2["Protobuf 序列化"]
    end

    style R1 fill:#4CAF50,color:#fff
    style G1 fill:#2196F3,color:#fff
    style GR1 fill:#FF9800,color:#fff
```

| 特性 | REST | GraphQL | gRPC |
|------|------|---------|------|
| **协议** | HTTP/1.1+ | HTTP/1.1+ | HTTP/2 |
| **数据格式** | JSON | JSON | Protobuf（二进制） |
| **灵活性** | 固定响应结构 | 客户端决定返回字段 | 固定 .proto 定义 |
| **性能** | 中 | 中（可能 N+1 问题） | 高（二进制+HTTP/2） |
| **学习曲线** | 低 | 中 | 高 |
| **工具支持** | 最广泛 | 需要特殊客户端 | 需要代码生成 |
| **适用场景** | 公开 API | 移动端（减少数据传输） | 微服务间通信 |
| **实时推送** | WebSocket/SSE | Subscription | 流式 RPC |

---

# 补充章节：负载均衡算法

> 📖 本节详解常见的负载均衡算法，帮你理解如何分配流量。

## 算法对比

```mermaid
graph TD
    A["客户端请求"] --> LB["负载均衡器"]
    LB --> B{算法选择}
    B -->|"轮询"| S1["服务器1"]
    B -->|"加权轮询"| S2["服务器2（权重高）"]
    B -->|"最少连接"| S3["服务器3（连接最少）"]
    B -->|"IP Hash"| S4["服务器N"]

    style LB fill:#9C27B0,color:#fff
```

| 算法 | 原理 | 优点 | 缺点 |
|------|------|------|------|
| 轮询 | 依次分配 | 简单公平 | 不考虑服务器能力差异 |
| 加权轮询 | 按权重分配 | 考虑服务器差异 | 需要手动配置权重 |
| 最少连接 | 分配给连接数最少的服务器 | 自适应负载 | 需要追踪连接数 |
| IP Hash | 对客户端 IP 哈希 | 同一客户端始终访问同一服务器 | 服务器增减时所有映射变化 |
| 一致性哈希 | 环形哈希空间 | 服务器增减时影响最小 | 实现复杂 |

---

# 补充章节：DNS 解析流程

> 📖 本节详解域名解析的完整过程。

## DNS 递归查询

```mermaid
sequenceDiagram
    participant C as 📱 浏览器
    participant R as 🔄 递归解析器
    participant Root as 🌐 根域名服务器
    participant TLD as 📦 TLD 服务器
    participant Auth as 🖥️ 权威服务器

    C->>R: 查询 www.example.com
    R->>Root: www.example.com？
    Root-->>R: 去问 .com TLD
    R->>TLD: www.example.com？
    TLD-->>R: 去问 example.com 权威
    R->>Auth: www.example.com？
    Auth-->>R: 93.184.216.34
    R-->>C: 93.184.216.34

    Note over C,R: 浏览器缓存 → 系统缓存 → 路由器缓存 → ISP 缓存 → 递归查询
```

---

# 补充章节：CDN 工作原理

> 📖 本节详解 CDN（内容分发网络）的工作原理。

## CDN 架构

```mermaid
graph TD
    U["用户（北京）"] -->|"1. 请求"| CDN_BJ["CDN 边缘节点（北京）"]
    CDN_BJ -->|"缓存命中"| U
    CDN_BJ -->|"2. 回源"| CDN_SH["CDN 源站（上海）"]
    CDN_SH -->|"3. 返回内容"| CDN_BJ
    CDN_BJ -->|"4. 返回+缓存"| U

    style CDN_BJ fill:#4CAF50,color:#fff
    style CDN_SH fill:#2196F3,color:#fff
```

| 概念 | 说明 |
|------|------|
| 边缘节点 | 部署在全球各地的缓存服务器 |
| 回源 | 边缘节点没有缓存时，向源站请求 |
| CNAME | 域名指向 CDN 厂商的域名 |
| 缓存策略 | Cache-Control + CDN 自定义规则 |
| 预热 | 提前将内容推送到边缘节点 |

---

> 📝 补充章节完成。本篇现在涵盖 OSI模型、TCP/UDP、HTTP全版本、WebSocket、REST/GraphQL/gRPC、负载均衡、DNS、CDN、TLS等完整的网络知识体系。

---

## 十一、TLS 1.3 握手流程详解

### 11.1 TLS 概述

TLS（Transport Layer Security）是 HTTPS 的安全基础。TLS 1.3 是目前最新的标准（RFC 8446），相比 TLS 1.2 有重大改进：

| 对比项 | TLS 1.2 | TLS 1.3 |
|--------|---------|---------|
| 握手延迟 | 2-RTT | **1-RTT**（甚至 0-RTT） |
| 密钥交换 | RSA / DHE / ECDHE | **仅 ECDHE / DHE** |
| 对称加密 | AES-CBC / AES-GRC | **仅 AEAD**（AES-GCM / ChaCha20） |
| 密码套件数量 | 37+ | **5 个** |
| 前向保密 | 可选 | **强制** |
| 0-RTT 恢复 | 不支持 | **支持**（有重放风险） |

### 11.2 TLS 1.3 1-RTT 握手序列图

```mermaid
sequenceDiagram
    participant C as 客户端 (Client)
    participant S as 服务器 (Server)

    Note over C: 生成 Client Key Share (ECDHE 临时密钥对)
    C->>S: ClientHello<br/>- 支持的 TLS 版本<br/>- 密码套件列表<br/>- Client Key Share (公钥)<br/>- PSK (如有)<br/>- SNI / ALPN 扩展

    Note over S: 选择密码套件<br/>生成 Server Key Share (ECDHE 临时密钥对)<br/>计算共享密钥 (Shared Secret)

    S->>C: ServerHello<br/>- 选定密码套件<br/>- Server Key Share (公钥)<br/>- PSK 选定 (如有)

    Note over S: Handshake Finished<br/>用共享密钥派生握手密钥

    S->>C: EncryptedExtensions<br/>- ALPN / 其他扩展

    S->>C: Certificate<br/>- 服务器证书链

    S->>C: CertificateVerify<br/>- 证书签名 (证明私钥持有)

    S->>C: Finished<br/>- 握手完整性校验

    Note over C: 用 ECDHE 公钥计算 Shared Secret<br/>派生握手密钥 & 应用密钥<br/>验证证书链 & 签名

    C->>S: Finished<br/>- 握手完整性校验

    Note over C,S: 🔒 握手完成，使用对称加密通信
    C->>S: Application Data (加密)
    S->>C: Application Data (加密)
```

### 11.3 关键概念解析

#### ECDHE 密钥交换

TLS 1.3 **强制使用**（EC）DHE 密钥交换，保证前向保密（Perfect Forward Secrecy, PFS）：

- 即使服务器私钥泄露，历史会话仍无法被解密
- 客户端和服务器各生成临时密钥对
- 通过椭圆曲线 Diffie-Hellman 计算出相同的共享密钥

```
客户端临时私钥 (a) + 服务器临时公钥 (B) → Shared Secret
服务器临时私钥 (b) + 客户端临时公钥 (A) → Shared Secret (相同)

数学原理：a × B = b × A = a × b × G
```

#### 密钥派生（HKDF）

TLS 1.3 使用 HKDF（HMAC-based Key Derivation Function）从共享密钥派生多个密钥：

```
Master Secret → HKDF-Expand → {
    Client Handshake Traffic Secret → 握手阶段客户端加密密钥
    Server Handshake Traffic Secret → 握手阶段服务器加密密钥
    Client Application Traffic Secret → 应用阶段客户端加密密钥
    Server Application Traffic Secret → 应用阶段服务器加密密钥
}
```

#### 证书链验证

客户端验证服务器证书的过程：

```
1. 收到服务器证书链：[Leaf Cert → Intermediate CA → Root CA]
2. 检查 Leaf Cert 的域名是否匹配请求的域名 (SNI)
3. 检查证书有效期（Not Before / Not After）
4. 用 Intermediate CA 的公钥验证 Leaf Cert 的签名
5. 用 Root CA 的公钥验证 Intermediate CA 的签名
6. 检查 Root CA 是否在本地信任存储中
7. 检查证书吊销状态（OCSP / CRL）
```

#### OCSP Stapling

传统 OCSP 需要客户端单独请求 CA 验证证书状态，增加了延迟。OCSP Stapling 让服务器主动缓存 OCSP 响应：

```
传统方式：客户端 → CA 的 OCSP 服务器（额外 RTT）
Stapling：服务器定期获取 OCSP 响应 → 握手时一并返回给客户端
```

### 11.4 TLS 1.3 0-RTT 恢复

0-RTT 允许客户端在握手第一个消息中就发送应用数据，实现"零延迟"恢复：

```mermaid
sequenceDiagram
    participant C as 客户端
    participant S as 服务器

    Note over C,S: 首次连接已完成，客户端保存了 PSK

    C->>S: ClientHello<br/>+ PSK (Pre-Shared Key)<br/>+ Early Data (0-RTT 应用数据!)

    Note over S: 验证 PSK<br/>解密 Early Data

    S->>C: ServerHello<br/>+ PSK 选定<br/>+ EncryptedExtensions

    S->>C: Finished

    C->>S: Finished

    Note over C,S: 正常加密通信继续
```

> ⚠️ **0-RTT 的安全风险**：0-RTT 数据没有前向保密保护，且存在**重放攻击**风险。只应用于幂等操作（如 GET 请求），不要用于修改数据的操作。

---

## 十二、HTTPS 完整工作原理

### 12.1 HTTPS = HTTP + TLS

HTTPS 不是一个独立的协议，而是 HTTP 在 TLS 层之上的安全传输：

```
┌──────────────────┐
│   HTTP 数据       │ ← 应用层
├──────────────────┤
│   TLS 加密层      │ ← 安全层（加密 + 完整性校验）
├──────────────────┤
│   TCP 传输层      │ ← 可靠传输
├──────────────────┤
│   IP 网络层       │ ← 寻址
└──────────────────┘
```

### 12.2 混合加密机制

HTTPS 使用两种加密方式的组合：

| 阶段 | 加密方式 | 用途 | 速度 |
|------|---------|------|------|
| 握手阶段 | **非对称加密**（RSA / ECDHE） | 密钥交换、身份认证 | 慢（~1000x） |
| 数据传输 | **对称加密**（AES-GCM / ChaCha20） | 加密实际数据 | 快 |

为什么不用非对称加密加密所有数据？因为非对称加密计算量大，比对称加密慢约 1000 倍。

### 12.3 完整 HTTPS 请求流程

```mermaid
sequenceDiagram
    participant B as 浏览器
    participant S as 服务器
    participant CA as CA 机构

    Note over B: 用户输入 https://example.com

    B->>S: TCP 三次握手 (SYN → SYN-ACK → ACK)
    B->>S: TLS 握手 (ClientHello...)
    S->>B: TLS 握手 (ServerHello + Certificate...)

    Note over B: 验证证书链<br/>检查域名匹配<br/>检查有效期<br/>检查吊销状态

    B->>B: 生成 Pre-Master Secret<br/>用服务器公钥加密发送

    Note over B,S: 双方计算 Master Secret<br/>派生对称加密密钥

    B->>S: HTTP 请求（对称加密）
    S->>B: HTTP 响应（对称加密）
```

### 12.4 证书类型对比

| 类型 | 验证级别 | 签发时间 | 价格 | 适用场景 |
|------|---------|---------|------|---------|
| DV（域名验证） | 仅验证域名所有权 | 分钟级 | 免费（Let's Encrypt） | 个人网站、博客 |
| OV（组织验证） | 验证组织真实性 | 1-3 天 | $$ | 企业网站 |
| EV（扩展验证） | 最严格审查 | 1-2 周 | $$$ | 金融、电商 |

### 12.5 HSTS（HTTP Strict Transport Security）

HSTS 强制浏览器使用 HTTPS 访问网站：

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

- `max-age`：强制 HTTPS 持续时间（秒）
- `includeSubDomains`：包含所有子域名
- `preload`：加入浏览器预加载列表

```mermaid
flowchart LR
    A[用户输入 http://example.com] --> B{浏览器检查 HSTS?}
    B -->|是| C[自动转为 https://example.com]
    B -->|否| D[发起 HTTP 请求]
    D --> E[服务器 301 重定向到 HTTPS]
    C --> F[安全连接]
    E --> F
```

### 12.6 Certificate Transparency（证书透明度）

CT 是一个开放框架，所有公开信任的证书都必须记录在公开的 CT 日志中：

```
1. CA 签发证书后，提交到 CT 日志服务器
2. 日志服务器返回 SCT（Signed Certificate Timestamp）
3. 服务器在 TLS 握手时携带 SCT
4. 浏览器验证 SCT，确保证书已公开记录
5. 域名所有者可以监控 CT 日志，发现未授权的证书
```

---

## 十三、HTTP 请求走私攻击与防御

### 13.1 什么是请求走私

HTTP 请求走私（Request Smuggling）是一种利用前端代理（如 CDN/负载均衡器）和后端服务器对 HTTP 请求边界解析不一致的攻击方式。

### 13.2 攻击原理

核心问题：`Content-Length`（CL）和 `Transfer-Encoding`（TE）头的处理差异。

```mermaid
flowchart TD
    A[恶意请求] --> B[前端代理]
    B -->|解析方式1| C[请求 A]
    B -->|解析方式2| D[请求 B 的一部分]
    C --> E[后端服务器]
    D --> E
    E --> F[请求走私成功!<br/>请求B被附加到请求A之后]
```

### 13.3 三种走私类型

#### CL.CL（Content-Length 冲突）

```
POST / HTTP/1.1
Host: example.com
Content-Length: 13
Content-Length: 6

Hello World!

→ 前端用 CL:13，读取完整 "Hello World!"
→ 后端用 CL:6，只读取 "Hello "，剩余 "World!" 污染下一个请求
```

#### CL.TE（Content-Length vs Transfer-Encoding）

```
POST / HTTP/1.1
Host: example.com
Content-Length: 15
Transfer-Encoding: chunked

0

SMUGGLED

→ 前端用 CL:15，认为请求体到 "SMUGGLED" 结束
→ 后端用 TE:chunked，认为 "0\r\n\r\n" 已结束，"SMUGGLED" 走私
```

#### TE.CL（Transfer-Encoding vs Content-Length）

```
POST / HTTP/1.1
Host: example.com
Transfer-Encoding: chunked
Content-Length: 4

5c
SMUGGLED...

→ 前端用 TE，按 chunked 解析
→ 后端用 CL:4，读取 "5c\r\n" 就停止
```

### 13.4 防御措施

| 防御手段 | 说明 |
|---------|------|
| 禁用 TE | 如果不使用 chunked 传输，直接禁用 Transfer-Encoding |
| 统一解析 | 前端和后端使用相同的 HTTP 解析逻辑 |
| 拒绝歧义请求 | 当 CL 和 TE 同时存在时，拒绝请求或优先使用 TE |
| HTTP/2 | HTTP/2 的帧结构天然避免了请求走私 |
| WAF 规则 | 检测异常的 CL/TE 组合 |

---

## 十四、API 网关概念

### 14.1 什么是 API 网关

API 网关是微服务架构中的统一入口，负责请求路由、认证、限流、监控等横切关注点。

```mermaid
flowchart LR
    C[客户端] --> GW[API 网关]
    GW --> S1[用户服务]
    GW --> S2[订单服务]
    GW --> S3[支付服务]
    GW --> S4[商品服务]
```

### 14.2 核心功能

| 功能 | 说明 |
|------|------|
| **路由转发** | 根据路径/域名将请求路由到不同后端服务 |
| **认证授权** | JWT 验证、OAuth2、API Key 校验 |
| **限流熔断** | 速率限制、熔断降级 |
| **负载均衡** | Round Robin、加权轮询、一致性哈希 |
| **日志监控** | 请求日志、链路追踪、指标采集 |
| **协议转换** | HTTP↔gRPC、REST↔GraphQL |
| **缓存** | 响应缓存、减少后端压力 |
| **CORS** | 跨域资源共享配置 |

### 14.3 主流 API 网关对比

| 特性 | Kong | Nginx (OpenResty) | Envoy |
|------|------|-------------------|-------|
| **语言** | Lua (Nginx + OpenResty) | C + Lua | C++ |
| **配置方式** | Admin API + 数据库 | 配置文件 + Lua 脚本 | xDS API / YAML |
| **动态配置** | ✅ 热更新（无需重启） | ⚠️ reload 或 Lua | ✅ xDS 动态发现 |
| **插件生态** | 🌟 丰富（100+ 官方插件） | 需手写 Lua | Filter 插件 |
| **服务发现** | DNS / Consul / K8s | 需额外配置 | 内置 xDS / EDS |
| **gRPC 代理** | ✅ | ✅ | ✅ 原生支持 |
| **性能** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **可观测性** | 内置日志/指标 | 需额外模块 | 🌟 内置丰富 |
| **学习曲线** | 中等 | 低（Nginx 用户） | 较陡 |
| **适用场景** | 微服务 API 管理 | 高性能反向代理 | Service Mesh Sidecar |
| **K8s Ingress** | Kong Ingress Controller | Nginx Ingress | Envoy (Istio) |

### 14.4 Kong 快速上手示例

```bash
# Docker 启动 Kong（带 PostgreSQL）
docker run -d --name kong-database \
  -e POSTGRES_USER=kong \
  -e POSTGRES_DB=kong \
  -e POSTGRES_PASSWORD=kong \
  postgres:13

docker run --rm --link kong-database:kong-database \
  -e KONG_DATABASE=postgres \
  -e KONG_PG_HOST=kong-database \
  kong:latest kong migrations bootstrap

docker run -d --name kong \
  --link kong-database:kong-database \
  -e KONG_DATABASE=postgres \
  -e KONG_PG_HOST=kong-database \
  -e KONG_PROXY_ACCESS_LOG=/dev/stdout \
  -e KONG_ADMIN_LISTEN=0.0.0.0:8001 \
  -p 8000:8000 -p 8443:8443 -p 8001:8001 \
  kong:latest

# 添加服务
curl -s http://localhost:8001/services/ \
  --data name=user-service \
  --data url=http://user-service:3000

# 添加路由
curl -s http://localhost:8001/services/user-service/routes \
  --data 'paths[]=/api/users' \
  --data name=user-routes

# 启用限流插件
curl -s http://localhost:8001/services/user-service/plugins \
  --data name=rate-limiting \
  --data config.second=10 \
  --data config.policy=local

# 启用 JWT 认证插件
curl -s http://localhost:8001/services/user-service/plugins \
  --data name=jwt
```

### 14.5 Envoy xDS 动态配置示例

```yaml
# Envoy 动态配置（通过 xDS API 获取）
node:
  id: "envoy-1"
  cluster: "my-cluster"

dynamic_resources:
  lds_config:
    ads: {}           # 通过 ADS 动态获取监听器配置
  cds_config:
    ads: {}           # 通过 ADS 动态获取集群配置
  ads_config:
    api_type: GRPC
    grpc_services:
      envoy_grpc:
        cluster_name: xds_cluster

static_resources:
  clusters:
  - name: xds_cluster
    connect_timeout: 1s
    type: STRICT_DNS
    lb_policy: ROUND_ROBIN
    http2_protocol_options: {}
    load_assignment:
      cluster_name: xds_cluster
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: xds-server
                port_value: 18000
```

---

## 十五、gRPC 四种通信模式

### 15.1 gRPC 简介

gRPC 是 Google 开发的高性能 RPC 框架，基于 HTTP/2 和 Protocol Buffers：

| 特性 | 说明 |
|------|------|
| 序列化 | Protocol Buffers（二进制，比 JSON 小 3-10x） |
| 传输 | HTTP/2（多路复用、头部压缩、服务端推送） |
| 接口定义 | `.proto` 文件（跨语言 IDL） |
| 代码生成 | 自动生成多语言客户端/服务端代码 |
| 流式支持 | 四种通信模式 |

### 15.2 Proto 文件定义

```protobuf
syntax = "proto3";
package helloworld;

service Greeter {
  // 模式1: Unary RPC
  rpc SayHello (HelloRequest) returns (HelloReply);

  // 模式2: Server-streaming RPC
  rpc ListGreetings (HelloRequest) returns (stream HelloReply);

  // 模式3: Client-streaming RPC
  rpc CollectGreetings (stream HelloRequest) returns (HelloReply);

  // 模式4: Bidirectional-streaming RPC
  rpc Chat (stream HelloRequest) returns (stream HelloReply);
}

message HelloRequest {
  string name = 1;
}

message HelloReply {
  string message = 1;
  int32 timestamp = 2;
}
```

### 15.3 四种通信模式详解

```mermaid
sequenceDiagram
    participant C as 客户端
    participant S as 服务器

    Note over C,S: 模式1: Unary（一元调用）
    C->>S: HelloRequest
    S->>C: HelloReply

    Note over C,S: 模式2: Server-Streaming（服务端流）
    C->>S: HelloRequest
    S->>C: HelloReply (1)
    S->>C: HelloReply (2)
    S->>C: HelloReply (3)
    S->>C: ... (流结束)

    Note over C,S: 模式3: Client-Streaming（客户端流）
    C->>S: HelloRequest (1)
    C->>S: HelloRequest (2)
    C->>S: HelloRequest (3)
    C->>S: ... (流结束)
    S->>C: HelloReply

    Note over C,S: 模式4: Bidirectional-Streaming（双向流）
    C->>S: HelloRequest (1)
    S->>C: HelloReply (1)
    C->>S: HelloRequest (2)
    S->>C: HelloReply (2)
    C->>S: ...
    S->>C: ...
```

#### 模式1: Unary RPC（一元调用）

最常见的模式，一次请求一次响应，类似普通 HTTP 请求：

```go
// Go 服务端实现
func (s *server) SayHello(ctx context.Context, req *pb.HelloRequest) (*pb.HelloReply, error) {
    return &pb.HelloReply{
        Message: "Hello " + req.Name,
    }, nil
}

// Go 客户端调用
resp, err := client.SayHello(ctx, &pb.HelloRequest{Name: "World"})
fmt.Println(resp.Message) // "Hello World"
```

#### 模式2: Server-Streaming RPC（服务端流）

客户端发送一个请求，服务器返回一个数据流：

```go
// Go 服务端实现
func (s *server) ListGreetings(req *pb.HelloRequest, stream pb.Greeter_ListGreetingsServer) error {
    greetings := []string{"Hello", "Hi", "Hey", "Howdy"}
    for _, g := range greetings {
        if err := stream.Send(&pb.HelloReply{
            Message: g + " " + req.Name,
        }); err != nil {
            return err
        }
    }
    return nil
}

// Go 客户端调用
stream, _ := client.ListGreetings(ctx, &pb.HelloRequest{Name: "World"})
for {
    resp, err := stream.Recv()
    if err == io.EOF {
        break
    }
    fmt.Println(resp.Message)
}
```

#### 模式3: Client-Streaming RPC（客户端流）

客户端发送数据流，服务器返回一个响应：

```go
// Go 服务端实现
func (s *server) CollectGreetings(stream pb.Greeter_CollectGreetingsServer) error {
    var names []string
    for {
        req, err := stream.Recv()
        if err == io.EOF {
            return stream.SendAndClose(&pb.HelloReply{
                Message: "Hello " + strings.Join(names, ", "),
            })
        }
        names = append(names, req.Name)
    }
}

// Go 客户端调用
stream, _ := client.CollectGreetings(ctx)
for _, name := range []string{"Alice", "Bob", "Charlie"} {
    stream.Send(&pb.HelloRequest{Name: name})
}
resp, _ := stream.CloseAndRecv()
fmt.Println(resp.Message)
```

#### 模式4: Bidirectional-Streaming RPC（双向流）

客户端和服务器都可以发送数据流，实现全双工通信：

```go
// Go 服务端实现
func (s *server) Chat(stream pb.Greeter_ChatServer) error {
    for {
        req, err := stream.Recv()
        if err == io.EOF {
            return nil
        }
        // 实时回显
        stream.Send(&pb.HelloReply{
            Message: "Echo: " + req.Name,
        })
    }
}
```

### 15.4 四种模式适用场景

| 模式 | 适用场景 | 示例 |
|------|---------|------|
| Unary | 普通 CRUD 操作 | 获取用户信息、创建订单 |
| Server-Streaming | 服务端推送大量数据 | 实时日志流、股票行情推送 |
| Client-Streaming | 客户端上传大量数据 | 文件上传、日志采集 |
| Bidirectional | 实时双向通信 | 聊天、实时游戏、协同编辑 |

---

## 十六、GraphQL Schema 与 Resolver

### 16.1 GraphQL vs REST

| 对比项 | REST | GraphQL |
|--------|------|---------|
| 端点 | 多个 URL | 单一端点 `/graphql` |
| 数据获取 | 服务器决定返回什么 | **客户端决定需要什么字段** |
| 过度获取 | 常见（返回多余字段） | 不会发生 |
| 不足获取 | 需要多次请求 | 一次请求获取所有需要的数据 |
| 版本管理 | URL 版本 (`/v1/`, `/v2/`) | 无需版本，字段渐进废弃 |
| 学习曲线 | 低 | 中等 |

### 16.2 Schema 定义示例

```graphql
# 类型定义
type User {
  id: ID!
  name: String!
  email: String!
  age: Int
  posts: [Post!]!       # 关联查询
  createdAt: DateTime!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!          # 反向关联
  comments: [Comment!]!
  tags: [String!]!
  status: PostStatus!
}

type Comment {
  id: ID!
  content: String!
  author: User!
  post: Post!
}

enum PostStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

# 查询类型
type Query {
  user(id: ID!): User
  users(limit: Int, offset: Int): [User!]!
  post(id: ID!): Post
  posts(tag: String, status: PostStatus): [Post!]!
  searchPosts(keyword: String!): [Post!]!
}

# 变更类型
type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
  deleteUser(id: ID!): Boolean!
  createPost(input: CreatePostInput!): Post!
  addComment(postId: ID!, content: String!): Comment!
}

# 输入类型
input CreateUserInput {
  name: String!
  email: String!
  age: Int
}

input UpdateUserInput {
  name: String
  email: String
  age: Int
}

input CreatePostInput {
  title: String!
  content: String!
  tags: [String!]
  status: PostStatus = DRAFT
}

# 订阅类型
type Subscription {
  postCreated: Post!
  commentAdded(postId: ID!): Comment!
}
```

### 16.3 Resolver 实现示例

```javascript
// Node.js + Apollo Server 示例
const resolvers = {
  Query: {
    user: async (_, { id }, { db }) => {
      return db.users.findById(id);
    },
    users: async (_, { limit = 10, offset = 0 }, { db }) => {
      return db.users.findMany({ skip: offset, take: limit });
    },
    posts: async (_, { tag, status }, { db }) => {
      const where = {};
      if (tag) where.tags = { has: tag };
      if (status) where.status = status;
      return db.posts.findMany({ where });
    },
    searchPosts: async (_, { keyword }, { db }) => {
      return db.posts.findMany({
        where: {
          OR: [
            { title: { contains: keyword, mode: 'insensitive' } },
            { content: { contains: keyword, mode: 'insensitive' } },
          ],
        },
      });
    },
  },

  // 字段级 Resolver（延迟加载 / N+1 问题优化）
  User: {
    posts: async (parent, _, { db, loaders }) => {
      // 使用 DataLoader 批量加载，避免 N+1 问题
      return loaders.postLoader.load(parent.id);
    },
  },

  Post: {
    author: async (parent, _, { loaders }) => {
      return loaders.userLoader.load(parent.authorId);
    },
    comments: async (parent, _, { loaders }) => {
      return loaders.commentLoader.load(parent.id);
    },
  },

  Mutation: {
    createUser: async (_, { input }, { db }) => {
      return db.users.create({ data: input });
    },
    createPost: async (_, { input }, { db, pubsub }) => {
      const post = await db.posts.create({ data: input });
      pubsub.publish('POST_CREATED', { postCreated: post });
      return post;
    },
    addComment: async (_, { postId, content }, { db, currentUser, pubsub }) => {
      const comment = await db.comments.create({
        data: { content, postId, authorId: currentUser.id },
      });
      pubsub.publish(`COMMENT_ADDED_${postId}`, { commentAdded: comment });
      return comment;
    },
  },

  Subscription: {
    postCreated: {
      subscribe: (_, __, { pubsub }) => pubsub.asyncIterator('POST_CREATED'),
    },
    commentAdded: {
      subscribe: (_, { postId }, { pubsub }) =>
        pubsub.asyncIterator(`COMMENT_ADDED_${postId}`),
    },
  },
};
```

### 16.4 GraphQL 查询示例

```graphql
# 查询用户及其文章（一次请求获取关联数据）
query GetUserWithPosts {
  user(id: "1") {
    name
    email
    posts {
      title
      tags
      comments {
        content
        author {
          name
        }
      }
    }
  }
}

# 创建文章
mutation CreateNewPost {
  createPost(input: {
    title: "学习 GraphQL"
    content: "GraphQL 是一种 API 查询语言..."
    tags: ["graphql", "api", "tutorial"]
    status: PUBLISHED
  }) {
    id
    title
    createdAt
  }
}

# 订阅新评论
subscription OnNewComment($postId: ID!) {
  commentAdded(postId: $postId) {
    id
    content
    author {
      name
    }
    createdAt
  }
}
```

### 16.5 N+1 问题与 DataLoader

GraphQL 的嵌套查询容易导致 N+1 查询问题：

```mermaid
flowchart TD
    A[查询 10 篇文章] --> B[1 次查询: SELECT * FROM posts LIMIT 10]
    B --> C{每篇文章需要作者信息}
    C --> D[再发 10 次查询: SELECT * FROM users WHERE id = ?]
    B -.->|N+1 问题| D

    E[使用 DataLoader] --> F[1 次查询: SELECT * FROM posts LIMIT 10]
    F --> G[收集所有 authorId]
    G --> H[1 次批量查询: SELECT * FROM users WHERE id IN (...)]
    F -.->|优化后| H
```

```javascript
// DataLoader 批量加载器
const DataLoader = require('dataloader');

const userLoader = new DataLoader(async (userIds) => {
  const users = await db.users.findMany({
    where: { id: { in: userIds } },
  });
  // DataLoader 要求返回的顺序与输入 ID 顺序一致
  return userIds.map(id => users.find(u => u.id === id) || null);
});
```

---

## 十七、WebSocket 与 SSE 对比

### 17.1 协议对比

| 对比项 | WebSocket | SSE (Server-Sent Events) |
|--------|-----------|-------------------------|
| 协议 | `ws://` / `wss://` | HTTP/1.1+ |
| 通信方向 | **全双工**（双向） | **单向**（服务器→客户端） |
| 数据格式 | 文本/二进制 | 仅文本（UTF-8） |
| 自动重连 | 需手动实现 | ✅ 浏览器内置 |
| 事件 ID / 恢复 | 需手动实现 | ✅ `Last-Event-ID` 自动恢复 |
| 浏览器 API | `WebSocket` | `EventSource` |
| 跨域 | 需额外处理 | 支持 CORS |
| 代理兼容性 | 较差（需特殊配置） | ✅ 良好（标准 HTTP） |
| 适用场景 | 聊天、游戏、协同编辑 | 通知、数据推送、进度更新 |

### 17.2 SSE 服务端示例

```javascript
// Node.js SSE 端点
const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    let id = 0;
    const interval = setInterval(() => {
      id++;
      const data = JSON.stringify({ time: new Date().toISOString(), id });

      // SSE 格式
      res.write(`id: ${id}\n`);       // 事件 ID（用于断线恢复）
      res.write(`event: message\n`);   // 事件类型
      res.write(`data: ${data}\n\n`);  // 数据（双换行结束）
    }, 1000);

    req.on('close', () => {
      clearInterval(interval);
    });
  }
});

server.listen(3000);
```

### 17.3 SSE 客户端示例

```javascript
// 浏览器端
const eventSource = new EventSource('/events');

// 监听默认事件
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('收到消息:', data);
};

// 监听自定义事件
eventSource.addEventListener('alert', (event) => {
  console.log('告警:', event.data);
});

// 断线自动重连 + 恢复
// 浏览器会自动携带 Last-Event-ID 头重新连接
eventSource.onerror = (event) => {
  console.log('连接断开，自动重连中...');
};

// 关闭连接
eventSource.close();
```

### 17.4 选择建议

```mermaid
flowchart TD
    A[需要实时通信?] -->|只需要服务器推送| B{需要二进制数据?}
    A -->|需要双向通信| C[使用 WebSocket]
    B -->|是| C
    B -->|否| D{需要自动重连?}
    D -->|是/都行| E[使用 SSE ✅]
    D -->|手动控制| F{连接数多?}
    F -->|是| C
    F -->|否| E
```

**经验法则**：
- 如果只需要服务器→客户端推送（通知、进度、行情），**优先选 SSE**
- 如果需要双向通信（聊天、游戏、协同编辑），**用 WebSocket**
- SSE 更简单、更可靠（自动重连）、代理兼容性更好

---

## 十八、HTTP 缓存机制深度

### 18.1 缓存分类

```mermaid
flowchart LR
    A[浏览器缓存] --> B[强缓存]
    A --> C[协商缓存]
    B --> D[Cache-Control]
    B --> E[Expires]
    C --> F[Last-Modified / If-Modified-Since]
    C --> G[ETag / If-None-Match]
```

### 18.2 强缓存 vs 协商缓存

| 对比项 | 强缓存 | 协商缓存 |
|--------|--------|---------|
| 是否发请求 | ❌ 不发请求 | ✅ 发请求（条件请求） |
| 状态码 | `200 (from cache)` | `304 Not Modified` |
| 优先级 | **高**（先检查强缓存） | 低（强缓存失效后） |
| 控制头 | `Cache-Control` / `Expires` | `ETag` + `Last-Modified` |

### 18.3 Cache-Control 指令详解

```http
# 响应头
Cache-Control: max-age=3600           # 缓存 3600 秒
Cache-Control: no-cache               # 每次使用前必须验证
Cache-Control: no-store               # 完全不缓存
Cache-Control: public                 # CDN 可缓存
Cache-Control: private                # 仅浏览器可缓存
Cache-Control: s-maxage=86400         # CDN 缓存时间（覆盖 max-age）
Cache-Control: immutable              # 永不变化（用于带 hash 的静态资源）
Cache-Control: must-revalidate        # 过期后必须验证
```

### 18.4 协商缓存流程

```mermaid
sequenceDiagram
    participant B as 浏览器
    participant S as 服务器

    B->>S: GET /style.css
    S->>B: 200 OK<br/>ETag: "abc123"<br/>Last-Modified: Wed, 01 Jan 2025<br/>Cache-Control: no-cache

    Note over B: 缓存资源<br/>下次使用前必须验证

    B->>S: GET /style.css<br/>If-None-Match: "abc123"<br/>If-Modified-Since: Wed, 01 Jan 2025

    Note over S: 资源未变化

    S->>B: 304 Not Modified<br/>(无响应体，使用缓存)
```

### 18.5 最佳实践

| 资源类型 | 缓存策略 | 原因 |
|---------|---------|------|
| 带 hash 的 JS/CSS | `Cache-Control: max-age=31536000, immutable` | 文件名变化=新文件，可永久缓存 |
| HTML 入口文件 | `Cache-Control: no-cache` | 总是验证，确保引用最新的静态资源 |
| API 响应 | `Cache-Control: no-store` | 数据实时性要求高 |
| 图片/字体 | `Cache-Control: max-age=86400` | 不常变化，缓存 1 天 |
| 用户敏感数据 | `Cache-Control: private, no-store` | 不允许 CDN/代理缓存 |

---

*本章节涵盖了 TLS 1.3、HTTPS 原理、请求走私、API 网关、gRPC、GraphQL、SSE 等高级网络协议主题。掌握这些内容将帮助你构建更安全、更高效的 Web 应用。*

---

## 十九、HTTP/2 与 HTTP/3 核心特性

### 19.1 HTTP 版本演进

| 特性 | HTTP/1.1 | HTTP/2 | HTTP/3 |
|------|----------|--------|--------|
| 传输协议 | TCP | TCP | **QUIC (UDP)** |
| 多路复用 | ❌ 队头阻塞 | ✅ 应用层多路复用 | ✅ 传输层多路复用 |
| 头部压缩 | ❌ | ✅ HPACK | ✅ QPACK |
| 服务端推送 | ❌ | ✅ | ⚠️ 已被移除 |
| 连接建立 | TCP + TLS = 3-RTT | TCP + TLS = 3-RTT | **1-RTT（甚至 0-RTT）** |
| 浏览器支持 | 所有 | 所有 | Chrome/Firefox/Edge |

### 19.2 HTTP/2 多路复用

HTTP/1.1 的队头阻塞问题：

```
请求1: [======] → 响应1: [======]
请求2:          [======] → 响应2:          [======]
请求3:                   [======] → 响应3:                   [======]

→ 请求必须排队，一个慢了全慢
```

HTTP/2 的多路复用：

```
请求1: [======] → 响应1: [===]
请求2: [======] → 响应2: [======]
请求3: [======] → 响应3: [====]

→ 所有请求/响应在同一连接上交错传输，互不阻塞
```

### 19.3 HTTP/3 与 QUIC

QUIC（Quick UDP Internet Connections）是 HTTP/3 的传输层协议：

```mermaid
flowchart LR
    subgraph HTTP/1.1 & HTTP/2
        A[HTTP] --> B[TCP]
        B --> C[IP]
    end

    subgraph HTTP/3
        D[HTTP/3] --> E[QUIC]
        E --> F[UDP]
        F --> G[IP]
    end
```

QUIC 的核心优势：

| 优势 | 说明 |
|------|------|
| **0-RTT 连接** | 已知服务器时，首次数据发送无需等待握手 |
| **无队头阻塞** | TCP 层丢包会阻塞所有流，QUIC 只阻塞对应流 |
| **连接迁移** | 从 WiFi 切换到 4G，连接不断开（基于 Connection ID） |
| **内置加密** | TLS 1.3 内置，无明文传输 |

### 19.4 服务器推送（Server Push）

HTTP/2 的服务端推送允许服务器主动发送资源，无需客户端请求：

```mermaid
sequenceDiagram
    participant C as 浏览器
    participant S as 服务器

    C->>S: GET /index.html
    S->>C: 响应 index.html
    Note over S: 预测需要 style.css 和 app.js
    S->>C: PUSH_PROMISE /style.css
    S->>C: PUSH_PROMISE /app.js
    S->>C: 发送 style.css 内容
    S->>C: 发送 app.js 内容
    Note over C: 资源已在缓存中，无需额外请求
```

> ⚠️ **注意**：HTTP/3 已移除服务端推送支持，因为实践中效果不佳（浏览器缓存通常已足够）。Chrome 从 2022 年起默认禁用 Server Push。

### 19.5 HPACK 与 QPACK 头部压缩

HTTP/1.1 每个请求都携带完整的头部，浪费带宽：

```
# 典型 HTTP/1.1 请求头部（~800 bytes）
GET /api/users HTTP/1.1
Host: example.com
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...
Accept: text/html,application/xhtml+xml,...
Accept-Language: en-US,en;q=0.9,zh-CN;q=0.8
Accept-Encoding: gzip, deflate, br
Connection: keep-alive
Cookie: session=abc123; preference=dark-theme; ...
```

HTTP/2 使用 HPACK 压缩：

```
# 静态表：预定义的 61 个常见头部
# :method: GET → 索引 2 (1 字节)
# :path: /   → 索引 4 (1 字节)

# 动态表：连接期间遇到的新头部自动添加
# 首次传输完整头部，后续只传索引号

# Huffman 编码：对头部值进行 Huffman 压缩
# "Accept-Encoding: gzip, deflate, br" → ~20 bytes
```

---

## 二十、DNS 解析与域名系统

### 20.1 DNS 解析流程

```mermaid
flowchart TD
    A[用户输入 example.com] --> B[浏览器缓存]
    B -->|未命中| C[操作系统缓存]
    C -->|未命中| D[路由器缓存]
    D -->|未命中| E[ISP DNS 服务器]
    E -->|未命中| F[根 DNS 服务器]
    F --> G[.com 顶级域名服务器]
    G --> H[example.com 权威 DNS 服务器]
    H --> I[返回 IP 地址: 93.184.216.34]
    I --> J[浏览器发起 HTTP 请求到该 IP]
```

### 20.2 DNS 记录类型

| 记录类型 | 用途 | 示例 |
|---------|------|------|
| **A** | 域名 → IPv4 地址 | `example.com → 93.184.216.34` |
| **AAAA** | 域名 → IPv6 地址 | `example.com → 2606:2800:220:1:...` |
| **CNAME** | 域名 → 另一个域名 | `www.example.com → example.com` |
| **MX** | 邮件服务器 | `example.com → mail.example.com` |
| **TXT** | 文本记录（SPF/DKIM） | `"v=spf1 include:_spf.google.com ~all"` |
| **NS** | 域名服务器 | `example.com → ns1.example.com` |
| **SRV** | 服务定位 | `_http._tcp.example.com → 80 web.example.com` |

### 20.3 DNS 缓存与 TTL

```bash
# 查看 DNS 记录
dig example.com

# 查询结果示例
;; ANSWER SECTION:
example.com.    3600    IN    A    93.184.216.34
;; ^^^           ^^^^         ^^^^
;; 域名          TTL(秒)      记录类型   IP地址

# TTL = 3600 表示缓存 1 小时后过期

# 清除本地 DNS 缓存
# macOS
sudo dscacheutil -flushcache

# Linux (systemd-resolved)
sudo systemd-resolve --flush-caches

# Windows
ipconfig /flushdns
```

### 20.4 DNS 与 CDN

CDN 使用 DNS 将用户路由到最近的边缘节点：

```mermaid
flowchart TD
    A[用户访问 cdn.example.com] --> B[DNS 解析]
    B --> C{GeoDNS 根据用户位置}
    C -->|北京用户| D[北京边缘节点 1.2.3.4]
    C -->|上海用户| E[上海边缘节点 5.6.7.8]
    C -->|广州用户| F[广州边缘节点 9.10.11.12]
```

---

*补充了 HTTP/2、HTTP/3、QUIC、DNS 解析等网络协议核心内容。*

---

## 12.11 HTTP 缓存完全指南

HTTP 缓存是提升 Web 性能最重要的手段之一。合理使用缓存可以显著减少网络传输、降低服务器压力、加快页面加载速度。

### 12.11.1 缓存的分类

```mermaid
graph TD
    A[HTTP 缓存] --> B[强缓存]
    A --> C[协商缓存]
    B --> D[Cache-Control]
    B --> E[Expires]
    C --> F[ETag / If-None-Match]
    C --> G[Last-Modified / If-Modified-Since]
    
    style B fill:#4CAF50,color:#fff
    style C fill:#2196F3,color:#fff
```

| 缓存类型 | 判断方式 | 是否发请求 | 状态码 | 性能 |
|---------|---------|-----------|--------|------|
| **强缓存** | 浏览器本地判断 | ❌ 不发请求 | 200 (from cache) | ⚡ 最快 |
| **协商缓存** | 需与服务器协商 | ✅ 发请求（可能无 body） | 304 Not Modified | 🔄 较快 |
| **无缓存** | 每次都请求 | ✅ 发完整请求 | 200 | 🐢 最慢 |

### 12.11.2 强缓存：Cache-Control

`Cache-Control` 是 HTTP/1.1 引入的缓存控制头部，优先级高于 `Expires`。

```http
# 常见 Cache-Control 指令
Cache-Control: max-age=3600          # 响应在 3600 秒内有效
Cache-Control: no-cache              # 不直接使用缓存，每次走协商缓存
Cache-Control: no-store              # 完全不缓存
Cache-Control: public                # 允许 CDN 等中间代理缓存
Cache-Control: private               # 只允许浏览器缓存，不允许代理缓存
Cache-Control: must-revalidate       # 过期后必须向服务器验证
Cache-Control: s-maxage=86400        # 仅对 CDN/代理生效，覆盖 max-age
Cache-Control: immutable             # 资源永远不会变，无需验证
```

**Cache-Control 指令速查表：**

| 指令 | 含义 | 适用场景 |
|------|------|---------|
| `max-age=N` | N 秒内直接用缓存 | 静态资源、API 响应 |
| `no-cache` | 先协商再用缓存 | HTML 页面、频繁变化的 API |
| `no-store` | 完全不缓存 | 敏感数据（密码、支付） |
| `public` | 任何缓存都可存储 | CDN 分发的公共资源 |
| `private` | 只有浏览器能缓存 | 用户个人数据 |
| `immutable` | 资源内容不变 | 带 hash 的 JS/CSS 文件 |
| `s-maxage=N` | CDN 缓存时间 | 覆盖 CDN 层的 max-age |
| `stale-while-revalidate=N` | 过期后 N 秒内可异步刷新 | 提升用户体验 |

**实际配置示例：**

```nginx
# Nginx 配置示例

# 带 hash 的静态资源 — 长期缓存
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}

# HTML 页面 — 协商缓存
location ~* \.html$ {
    add_header Cache-Control "no-cache, must-revalidate";
}

# API 接口 — 短期缓存或不缓存
location /api/ {
    add_header Cache-Control "no-store, private";
}
```

### 12.11.3 强缓存：Expires（已过时）

```http
Expires: Thu, 01 Jan 2026 00:00:00 GMT
```

> ⚠️ `Expires` 是 HTTP/1.0 的遗留头部，使用绝对时间，存在客户端与服务器时钟不一致的问题。**推荐使用 `Cache-Control: max-age` 替代。**

### 12.11.4 协商缓存：ETag / If-None-Match

ETag 是资源的唯一标识（通常是内容的哈希值）。

```http
# 第一次请求 — 服务器返回 ETag
HTTP/1.1 200 OK
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
Content-Length: 4321

# 后续请求 — 浏览器携带 If-None-Match
GET /style.css
If-None-Match: "33a64df551425fcc55e4d42a148795d9f25f89d4"

# 服务器对比 ETag，如果没变返回 304
HTTP/1.1 304 Not Modified
```

**ETag 的两种类型：**

| 类型 | 生成方式 | 优点 | 缺点 |
|------|---------|------|------|
| **强 ETag** | `ETag: "abc123"` 精确匹配 | 字节级精确 | 分布式环境计算开销大 |
| **弱 ETag** | `W/"abc123"` 语义匹配 | 性能好，允许微小差异 | 不够精确 |

### 12.11.5 协商缓存：Last-Modified / If-Modified-Since

```http
# 第一次请求 — 服务器返回 Last-Modified
HTTP/1.1 200 OK
Last-Modified: Wed, 21 Oct 2025 07:28:00 GMT

# 后续请求 — 浏览器携带 If-Modified-Since
GET /style.css
If-Modified-Since: Wed, 21 Oct 2025 07:28:00 GMT

# 服务器对比修改时间
HTTP/1.1 304 Not Modified
```

### 12.11.6 启发式缓存

当响应中**既没有 `Cache-Control` 也没有 `Expires`** 时，浏览器会使用启发式缓存（Heuristic Caching）：

```
缓存时间 = (Date - Last-Modified) × 10%
```

```http
# 示例：Last-Modified 是 100 天前
Date: Thu, 28 May 2026 00:00:00 GMT
Last-Modified: Thu, 17 Feb 2026 00:00:00 GMT

# 浏览器计算：100天 × 10% = 10天内可直接使用缓存
```

> ⚠️ 启发式缓存是浏览器的"猜测"行为，**不应依赖**。始终显式设置 `Cache-Control`。

### 12.11.7 缓存决策流程图

```mermaid
flowchart TD
    Start([浏览器发起请求]) --> HasCache{本地有缓存?}
    HasCache -->|否| Server[向服务器请求]
    Server --> Response[返回 200 + 资源]
    Response --> SaveCache[存储缓存]
    
    HasCache -->|是| CheckStrong{强缓存检查<br/>Cache-Control / Expires}
    CheckStrong -->|未过期| UseCache[✅ 直接使用缓存<br/>200 from cache]
    
    CheckStrong -->|已过期| CheckETag{有 ETag 或<br/>Last-Modified?}
    CheckETag -->|有 ETag| SendETag[发送 If-None-Match]
    CheckETag -->|有 Last-Modified| SendLM[发送 If-Modified-Since]
    CheckETag -->|都没有| Server
    
    SendETag --> ServerCheck{服务器检查}
    SendLM --> ServerCheck
    
    ServerCheck -->|资源未变| NotModified[返回 304<br/>使用缓存]
    ServerCheck -->|资源已变| Server
    
    style UseCache fill:#4CAF50,color:#fff
    style NotModified fill:#2196F3,color:#fff
    style Server fill:#FF9800,color:#fff
```

### 12.11.8 缓存策略最佳实践

```mermaid
graph LR
    A[资源类型] --> B{内容会变吗?}
    B -->|永不变化| C[immutable + 长 max-age]
    B -->|偶尔变化| D[no-cache + ETag]
    B -->|频繁变化| E[no-store 或短 max-age]
    B -->|用户私有| F[private + 短 max-age]
    
    C --> G[带 hash 的 JS/CSS/图片]
    D --> H[HTML 页面]
    E --> I[API 接口数据]
    F --> J[用户个人信息]
```

**前端资源缓存方案：**

```javascript
// Webpack/Vite 打包配置 — 文件名带 hash
// main.a1b2c3d4.js → 内容不变则 hash 不变

// vite.config.ts
export default {
  build: {
    rollupOptions: {
      output: {
        // 代码分割 + 内容 hash
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    }
  }
}
```

| 资源类型 | 推荐策略 | 原因 |
|---------|---------|------|
| 带 hash 的 JS/CSS | `max-age=31536000, immutable` | 文件名变 = 内容变 |
| HTML 入口文件 | `no-cache` | 每次检查是否有新版本 |
| API 接口 | `no-store` 或 `max-age=0` | 数据实时性要求高 |
| 用户头像 | `max-age=86400` | 允许 1 天延迟 |
| 静态图标/SVG | `max-age=31536000` | 很少变化 |

---

## 12.12 Cookie / Session / JWT Token 完整对比

### 12.12.1 三种认证方式概述

```mermaid
graph TB
    subgraph Cookie-Session
        CS1[浏览器] -->|Cookie: session_id=abc| CS2[服务器]
        CS2 -->|查询 Session 存储| CS3[(Session Store)]
    end
    
    subgraph JWT Token
        JT1[客户端] -->|Authorization: Bearer eyJhbG...| JT2[服务器]
        JT2 -->|验证签名| JT3[无需存储]
    end
    
    subgraph 混合方案
        MX1[客户端] -->|HttpOnly Cookie 存 JWT| MX2[服务器]
        MX2 -->|验证 JWT 签名| MX3[无需存储]
    end
```

### 12.12.2 Cookie 详解

```http
# 服务器设置 Cookie
Set-Cookie: session_id=abc123; Domain=.example.com; Path=/; 
            Expires=Thu, 01 Jan 2027 00:00:00 GMT; 
            HttpOnly; Secure; SameSite=Lax

# 浏览器后续请求自动携带
Cookie: session_id=abc123
```

**Cookie 属性详解：**

| 属性 | 作用 | 示例 |
|------|------|------|
| `Name=Value` | Cookie 名称和值 | `session_id=abc123` |
| `Domain` | 适用域名 | `.example.com`（含子域名） |
| `Path` | 适用路径 | `/api` |
| `Expires/Max-Age` | 过期时间 | `Expires=Thu, 01 Jan 2027` |
| `HttpOnly` | 禁止 JS 访问 | 防 XSS 窃取 |
| `Secure` | 仅 HTTPS 传输 | 防中间人攻击 |
| `SameSite` | 跨站限制 | `Strict` / `Lax` / `None` |

**SameSite 策略对比：**

| 值 | 跨站请求携带规则 | 安全性 | 兼容性 |
|----|----------------|--------|--------|
| `Strict` | 完全不携带 | 🔒 最高 | 可能影响用户体验 |
| `Lax` | 顶级导航的 GET 请求携带 | 🔒 较高 | **推荐默认值** |
| `None` | 始终携带（需 Secure） | ⚠️ 较低 | 跨站场景必需 |

### 12.12.3 Session 详解

```javascript
// Express.js Session 示例
const express = require('express');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const Redis = require('ioredis');

const redisClient = new Redis();

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,        // 仅 HTTPS
    httpOnly: true,       // 禁止 JS 访问
    maxAge: 24 * 60 * 60 * 1000,  // 24 小时
    sameSite: 'lax'
  }
}));

// 登录 — 创建 Session
app.post('/login', (req, res) => {
  const user = authenticate(req.body);
  if (user) {
    req.session.userId = user.id;
    req.session.role = user.role;
    res.json({ success: true });
  }
});

// 鉴权 — 读取 Session
app.get('/profile', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: '未登录' });
  }
  res.json({ userId: req.session.userId });
});
```

### 12.12.4 JWT Token 详解

**JWT 的结构：**

```
Header.Payload.Signature

# Header（头部）
{"alg": "HS256", "typ": "JWT"}

# Payload（载荷）
{"sub": "1234567890", "name": "张三", "role": "admin", "exp": 1735689600}

# Signature（签名）
HMACSHA256(base64UrlEncode(header) + "." + base64UrlEncode(payload), secret)
```

```javascript
// JWT 实现示例
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET;

// 生成 Token
function generateToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      name: user.name,
      role: user.role
    },
    SECRET_KEY,
    { expiresIn: '24h' }
  );
}

// 验证中间件
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '缺少 Token' });
  }

  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, SECRET_KEY);
    req.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token 已过期' });
    }
    return res.status(401).json({ error: 'Token 无效' });
  }
}

// 刷新 Token
app.post('/refresh', authMiddleware, (req, res) => {
  const newToken = generateToken(req.user);
  res.json({ token: newToken });
});
```

### 12.12.5 三种方案完整对比

| 对比维度 | Cookie + Session | JWT Token | JWT + HttpOnly Cookie |
|---------|-----------------|-----------|----------------------|
| **存储位置** | 服务端（Session Store） | 客户端（localStorage/内存） | 客户端（HttpOnly Cookie） |
| **服务端状态** | 有状态 | 无状态 | 无状态 |
| **扩展性** | 需共享 Session Store | ⭐ 天然支持分布式 | ⭐ 天然支持分布式 |
| **CSRF 防护** | 需额外防护 | ✅ 不会自动发送 | 需额外防护 |
| **XSRF 防护** | ✅ HttpOnly Cookie | ✅ 不在 Cookie 中 | ✅ SameSite 属性 |
| **跨域支持** | 需配置 CORS + Credentials | ⭐ 天然支持 | 需配置 CORS |
| **移动端支持** | 需 WebView 支持 Cookie | ⭐ 原生支持 | 需额外处理 |
| **服务端注销** | ✅ 删除 Session 即可 | ❌ 需黑名单机制 | ❌ 需黑名单机制 |
| **Token 大小** | 仅 ID（小） | 包含用户信息（较大） | 包含用户信息（较大） |
| **性能** | 每次查询 Session Store | ⭐ 无需查询存储 | ⭐ 无需查询存储 |
| **适用场景** | 传统 Web 应用 | 前后端分离、移动端 | 前后端分离（安全优先） |

### 12.12.6 移动端认证最佳实践

```mermaid
sequenceDiagram
    participant App as 移动 App
    participant API as API 服务器
    participant Auth as 认证服务
    
    App->>Auth: POST /auth/login {username, password}
    Auth->>Auth: 验证凭据
    Auth-->>App: {access_token, refresh_token}
    
    Note over App: access_token 存内存<br/>refresh_token 存 SecureStorage
    
    App->>API: GET /api/profile<br/>Authorization: Bearer {access_token}
    API->>API: 验证 JWT 签名和过期时间
    API-->>App: {user data}
    
    Note over App: access_token 过期
    App->>Auth: POST /auth/refresh {refresh_token}
    Auth-->>App: {new_access_token, new_refresh_token}
    
    App->>API: GET /api/data<br/>Authorization: Bearer {new_access_token}
    API-->>App: {data}
```

```javascript
// 移动端 Token 管理
class TokenManager {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  async login(username: string, password: string) {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const { access_token, refresh_token } = await response.json();
    
    // access_token 存内存（最安全）
    this.accessToken = access_token;
    
    // refresh_token 存 SecureStorage（持久化）
    await SecureStorage.set('refresh_token', refresh_token);
  }

  async fetchWithAuth(url: string, options: RequestInit = {}) {
    let response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    // access_token 过期，尝试刷新
    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${this.accessToken}`
          }
        });
      }
    }

    return response;
  }

  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = await SecureStorage.get('refresh_token');
    if (!refreshToken) return false;

    const response = await fetch('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (response.ok) {
      const { access_token, refresh_token } = await response.json();
      this.accessToken = access_token;
      await SecureStorage.set('refresh_token', refresh_token);
      return true;
    }

    // 刷新失败，需要重新登录
    await this.logout();
    return false;
  }
}
```

---

## 12.13 RESTful API 设计最佳实践

### 12.13.1 URL 命名规范

```
✅ 正确示范
GET    /api/v1/users              # 获取用户列表
GET    /api/v1/users/123          # 获取单个用户
POST   /api/v1/users              # 创建用户
PUT    /api/v1/users/123          # 更新用户（全量）
PATCH  /api/v1/users/123          # 更新用户（部分）
DELETE /api/v1/users/123          # 删除用户

✅ 子资源
GET    /api/v1/users/123/orders   # 获取用户的订单
POST   /api/v1/users/123/orders   # 为用户创建订单

❌ 错误示范
GET    /api/getUsers              # 不要用动词
POST   /api/user/create           # 不要混合单复数
GET    /api/v1/user_list          # 不要用下划线
DELETE /api/v1/deleteUser/123     # 动词冗余
```

**URL 命名规则清单：**

| 规则 | ✅ 正确 | ❌ 错误 |
|------|--------|--------|
| 使用名词复数 | `/users` | `/user`、`/getUser` |
| 使用小写 + 连字符 | `/user-profiles` | `/UserProfiles`、`/user_profiles` |
| 层级用 `/` 表示 | `/users/123/orders` | `/users/123/orders` ✅ |
| 查询用 `?` 参数 | `/users?role=admin` | `/users/role/admin` |
| 避免暴露实现细节 | `/users` | `/mysql/users` |

### 12.13.2 API 版本管理

| 方式 | 示例 | 优点 | 缺点 |
|------|------|------|------|
| URL 路径 | `/api/v1/users` | 直观、易缓存 | URL 变动大 |
| 请求头 | `Accept: application/vnd.api.v1+json` | URL 干净 | 调试不直观 |
| 查询参数 | `/api/users?version=1` | 简单 | 不够优雅 |

```javascript
// Express 版本路由
const express = require('express');

const v1Router = require('./routes/v1');
const v2Router = require('./routes/v2');

app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);

// v2 中兼容 v1
const v2UsersRouter = express.Router();

// 新增字段
v2UsersRouter.get('/:id', async (req, res) => {
  const user = await userService.findById(req.params.id);
  
  // v2 新增 avatar 字段
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar    // v2 新增
  });
});
```

### 12.13.3 分页、过滤与排序

```http
# 分页
GET /api/v1/users?page=2&per_page=20

# 游标分页（大数据量推荐）
GET /api/v1/users?cursor=eyJpZCI6MTAwfQ&limit=20

# 过滤
GET /api/v1/users?role=admin&status=active&created_after=2026-01-01

# 排序
GET /api/v1/users?sort=-created_at,name
# - 前缀表示降序，多个字段用逗号分隔

# 字段选择（减少传输量）
GET /api/v1/users?fields=id,name,email
```

**统一分页响应格式：**

```json
{
  "data": [
    {"id": 1, "name": "张三"},
    {"id": 2, "name": "李四"}
  ],
  "pagination": {
    "page": 2,
    "per_page": 20,
    "total": 156,
    "total_pages": 8,
    "has_next": true,
    "has_prev": true
  },
  "links": {
    "self": "/api/v1/users?page=2&per_page=20",
    "first": "/api/v1/users?page=1&per_page=20",
    "prev": "/api/v1/users?page=1&per_page=20",
    "next": "/api/v1/users?page=3&per_page=20",
    "last": "/api/v1/users?page=8&per_page=20"
  }
}
```

### 12.13.4 统一错误响应格式

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数验证失败",
    "details": [
      {
        "field": "email",
        "message": "邮箱格式不正确",
        "value": "not-an-email"
      },
      {
        "field": "age",
        "message": "年龄必须大于 0",
        "value": -5
      }
    ],
    "request_id": "req_abc123",
    "timestamp": "2026-05-28T12:00:00Z"
  }
}
```

**HTTP 状态码使用规范：**

| 状态码 | 含义 | 使用场景 |
|--------|------|---------|
| 200 | OK | GET 成功、PUT/PATCH 更新成功 |
| 201 | Created | POST 创建成功 |
| 204 | No Content | DELETE 删除成功 |
| 400 | Bad Request | 参数格式错误 |
| 401 | Unauthorized | 未认证 |
| 403 | Forbidden | 无权限 |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 资源冲突（如重复创建） |
| 422 | Unprocessable Entity | 参数语义错误 |
| 429 | Too Many Requests | 请求频率超限 |
| 500 | Internal Server Error | 服务器内部错误 |
| 502 | Bad Gateway | 网关错误 |
| 503 | Service Unavailable | 服务不可用 |

---

## 12.14 API 网关架构

### 12.14.1 什么是 API 网关

API 网关是微服务架构的统一入口，负责请求路由、认证鉴权、限流熔断、日志监控等横切关注点。

```mermaid
graph TB
    Client[客户端] --> Gateway[API 网关]
    
    Gateway --> Auth[认证鉴权]
    Gateway --> RateLimit[限流控制]
    Gateway --> LB[负载均衡]
    Gateway --> Cache[响应缓存]
    Gateway --> Log[日志监控]
    
    LB --> S1[用户服务]
    LB --> S2[订单服务]
    LB --> S3[商品服务]
    LB --> S4[支付服务]
    
    style Gateway fill:#FF6B35,color:#fff
```

### 12.14.2 主流 API 网关对比

| 特性 | Kong | Nginx (OpenResty) | Apache APISIX |
|------|------|-------------------|---------------|
| **开发语言** | Lua (Nginx + OpenResty) | C + Lua | Lua (Nginx + OpenResty) |
| **配置方式** | Admin API + 数据库 | 配置文件 + Lua 脚本 | Admin API + etcd |
| **热更新** | ✅ 无需重启 | ❌ 需 reload | ✅ 无需重启 |
| **插件生态** | ⭐ 丰富（100+） | 需自行开发 | ⭐ 丰富（80+） |
| **性能** | 高 | ⭐ 最高 | 高 |
| **集群方案** | 数据库共享 | 无内置方案 | etcd 集群 |
| **Dashboard** | Kong Manager（企业版） | 无 | ✅ 内置 |
| **Service Mesh** | Kong Mesh | 需额外方案 | ✅ 内置 |
| **学习曲线** | 中等 | 较高 | 较低 |
| **适用场景** | 企业级、K8s | 高性能代理 | 云原生、微服务 |

### 12.14.3 限流、熔断与降级

```mermaid
graph LR
    A[请求] --> B{限流检查}
    B -->|通过| C{熔断检查}
    B -->|拒绝| D[429 Too Many Requests]
    C -->|关闭| E[请求后端服务]
    C -->|打开| F[降级响应]
    E -->|成功| G[返回结果]
    E -->|失败| H{失败计数}
    H -->|超过阈值| I[熔断器打开]
    H -->|未超过| G
    
    style D fill:#f44336,color:#fff
    style F fill:#FF9800,color:#fff
    style I fill:#f44336,color:#fff
```

**限流算法对比：**

| 算法 | 原理 | 优点 | 缺点 |
|------|------|------|------|
| **固定窗口** | 固定时间段内限制请求数 | 实现简单 | 窗口边界突发 |
| **滑动窗口** | 滑动时间窗口计数 | 平滑限流 | 内存占用较大 |
| **令牌桶** | 以固定速率放入令牌 | 允许短时突发 | 实现较复杂 |
| **漏桶** | 以固定速率处理请求 | 流量完全平滑 | 无法应对突发 |

```javascript
// 令牌桶限流示例
class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,    // 桶容量
    private refillRate: number   // 每秒补充令牌数
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  tryConsume(count: number = 1): boolean {
    this.refill();
    
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.capacity,
      this.tokens + elapsed * this.refillRate
    );
    this.lastRefill = now;
  }
}

// 使用
const limiter = new TokenBucket(100, 10); // 容量100，每秒补充10个

app.use((req, res, next) => {
  if (limiter.tryConsume()) {
    next();
  } else {
    res.status(429).json({ error: '请求过于频繁' });
  }
});
```

**熔断器模式：**

```javascript
enum CircuitState {
  CLOSED = 'CLOSED',     // 正常（请求通过）
  OPEN = 'OPEN',         // 熔断（请求拒绝）
  HALF_OPEN = 'HALF_OPEN' // 半开（试探恢复）
}

class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(
    private failureThreshold: number = 5,    // 失败阈值
    private recoveryTimeout: number = 30000  // 恢复超时（ms）
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error('熔断器已打开，请求被拒绝');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }
}
```

---

## 12.15 微服务通信模式

### 12.15.1 同步通信 vs 异步通信

```mermaid
graph TB
    subgraph 同步通信
        SC1[服务 A] -->|REST/gRPC| SC2[服务 B]
        SC2 -->|响应| SC1
    end
    
    subgraph 异步通信
        AC1[服务 A] -->|发布消息| MQ[消息队列]
        MQ -->|消费消息| AC2[服务 B]
        MQ -->|消费消息| AC3[服务 C]
    end
    
    style SC1 fill:#2196F3,color:#fff
    style SC2 fill:#2196F3,color:#fff
    style MQ fill:#FF9800,color:#fff
```

### 12.15.2 REST vs gRPC vs 消息队列

| 维度 | REST/HTTP | gRPC | 消息队列 |
|------|-----------|------|---------|
| **通信方式** | 同步 | 同步 | 异步 |
| **协议** | HTTP/1.1 | HTTP/2 | AMQP/MQTT/Kafka |
| **数据格式** | JSON | Protobuf（二进制） | 任意 |
| **性能** | 一般 | ⭐ 高（10x+） | 高（取决于队列） |
| **流式支持** | SSE / WebSocket | ✅ 原生支持 | ✅ 天然支持 |
| **代码生成** | OpenAPI | ✅ .proto 自动生成 | 无标准 |
| **耦合度** | 中 | 中 | ⭐ 低 |
| **适用场景** | Web API、公开接口 | 内部服务间调用 | 事件驱动、解耦 |
| **学习曲线** | 低 | 中 | 中 |

```protobuf
// gRPC 定义示例 (user.proto)
syntax = "proto3";

package user;

service UserService {
  rpc GetUser (GetUserRequest) returns (User);
  rpc ListUsers (ListUsersRequest) returns (stream User);  // 服务端流
  rpc CreateUsers (stream CreateUserRequest) returns (CreateUsersResponse);  // 客户端流
}

message GetUserRequest {
  int32 id = 1;
}

message User {
  int32 id = 1;
  string name = 2;
  string email = 3;
  int64 created_at = 4;
}

message ListUsersRequest {
  int32 page = 1;
  int32 per_page = 2;
}
```

### 12.15.3 微服务架构全景图

```mermaid
graph TB
    Client[客户端] --> Gateway[API 网关]
    
    Gateway --> UserSvc[用户服务]
    Gateway --> OrderSvc[订单服务]
    Gateway --> ProductSvc[商品服务]
    Gateway --> NotifySvc[通知服务]
    
    subgraph 同步调用
        OrderSvc -->|gRPC| UserSvc
        OrderSvc -->|gRPC| ProductSvc
    end
    
    subgraph 异步消息
        OrderSvc -->|订单创建事件| MQ[Kafka/RabbitMQ]
        MQ --> NotifySvc
        MQ --> InventorySvc[库存服务]
        MQ --> AnalyticsSvc[数据分析]
    end
    
    subgraph 数据存储
        UserSvc --> UserDB[(PostgreSQL)]
        OrderSvc --> OrderDB[(PostgreSQL)]
        ProductSvc --> ProductDB[(MongoDB)]
        NotifySvc --> Redis[(Redis)]
    end
    
    style Gateway fill:#FF6B35,color:#fff
    style MQ fill:#FF9800,color:#fff
```

---

## 12.16 HTTP 安全头部清单

### 12.16.1 安全头部总览

| 安全头部 | 作用 | 推荐值 |
|---------|------|--------|
| `Content-Security-Policy` | 防 XSS、数据注入 | 见下方详细配置 |
| `Strict-Transport-Security` | 强制 HTTPS | `max-age=31536000; includeSubDomains` |
| `X-Content-Type-Options` | 防 MIME 嗅探 | `nosniff` |
| `X-Frame-Options` | 防点击劫持 | `DENY` 或 `SAMEORIGIN` |
| `Referrer-Policy` | 控制 Referer 信息 | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | 控制浏览器特性 | 见下方配置 |
| `X-XSS-Protection` | XSS 过滤（已过时） | `0`（使用 CSP 替代） |

### 12.16.2 Content-Security-Policy (CSP)

CSP 是防御 XSS 攻击最强大的手段，通过白名单机制限制资源加载来源。

```http
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' https://cdn.example.com 'nonce-abc123';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: https:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.example.com wss://ws.example.com;
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
```

**CSP 指令详解：**

| 指令 | 控制内容 | 常用值 |
|------|---------|--------|
| `default-src` | 默认资源策略 | `'self'` |
| `script-src` | JavaScript 来源 | `'self'`, `'nonce-xxx'`, `'strict-dynamic'` |
| `style-src` | CSS 来源 | `'self'`, `'unsafe-inline'` |
| `img-src` | 图片来源 | `'self'`, `data:`, `https:` |
| `font-src` | 字体来源 | `'self'`, CDN 地址 |
| `connect-src` | AJAX/WebSocket | API 域名 |
| `frame-src` | iframe 来源 | `'none'` 或允许的域名 |
| `frame-ancestors` | 谁能嵌入此页面 | `'none'`（类似 X-Frame-Options） |

```javascript
// Node.js + Helmet 配置 CSP
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'nonce-{random}'", "https://cdn.example.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://api.example.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
```

### 12.16.3 HSTS（HTTP Strict Transport Security）

```http
# 基本配置 — 1 年内强制 HTTPS
Strict-Transport-Security: max-age=31536000

# 含子域名
Strict-Transport-Security: max-age=31536000; includeSubDomains

# 预加载（提交到浏览器预加载列表）
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**HSTS 工作流程：**

```mermaid
sequenceDiagram
    participant Browser as 浏览器
    participant Server as 服务器
    
    Browser->>Server: 第一次 HTTP 请求
    Server-->>Browser: 301 重定向到 HTTPS + HSTS 头
    
    Browser->>Server: HTTPS 请求
    Server-->>Browser: 200 + Strict-Transport-Security
    
    Note over Browser: 记录 HSTS<br/>未来自动升级为 HTTPS
    
    Browser->>Server: HTTP 请求（自动转为 HTTPS）
    Note over Browser: 浏览器直接发 HTTPS<br/>不再发 HTTP
```

### 12.16.4 完整 Nginx 安全配置

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;

    # SSL 配置
    ssl_certificate /etc/ssl/certs/example.com.pem;
    ssl_certificate_key /etc/ssl/private/example.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers on;

    # ===== 安全头部 =====
    
    # CSP
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'nonce-{random}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://api.example.com; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests" always;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # 防点击劫持
    add_header X-Frame-Options "DENY" always;

    # 防 MIME 嗅探
    add_header X-Content-Type-Options "nosniff" always;

    # Referrer 策略
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 权限策略
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self), payment=(self)" always;

    # 关闭旧版 XSS 过滤（用 CSP 替代）
    add_header X-XSS-Protection "0" always;
}

# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name example.com;
    return 301 https://$server_name$request_uri;
}
```

### 12.16.5 安全头部检测

```bash
# 使用 curl 检查响应头
curl -sI https://example.com | grep -iE '(content-security|strict-transport|x-frame|x-content-type|referrer-policy|permissions-policy)'

# 使用 securityheaders.com 在线检测
# https://securityheaders.com/?q=example.com

# 使用 Mozilla Observatory
# https://observatory.mozilla.org/
```

**安全评级标准：**

| 评级 | 要求 |
|------|------|
| A+ | 所有安全头部都正确配置，HSTS 含 preload |
| A | 主要安全头部已配置 |
| B | 部分安全头部已配置 |
| C | 仅配置基础安全头部 |
| D/F | 缺少关键安全头部 |

---

## 12.17 HTTP/2 与 HTTP/3 协议演进

### 12.17.1 HTTP 版本对比

| 特性 | HTTP/1.1 | HTTP/2 | HTTP/3 |
|------|----------|--------|--------|
| **传输协议** | TCP | TCP | QUIC (UDP) |
| **多路复用** | ❌ 队头阻塞 | ✅ 应用层多路复用 | ✅ 无队头阻塞 |
| **头部压缩** | ❌ 无 | ✅ HPACK | ✅ QPACK |
| **服务器推送** | ❌ 不支持 | ✅ 支持 | ✅ 支持 |
| **二进制帧** | ❌ 文本 | ✅ 二进制 | ✅ 二进制 |
| **连接建立** | TCP + TLS = 2-3 RTT | TCP + TLS = 2-3 RTT | ⭐ 0-1 RTT |
| **加密** | 可选 | 实际上必须 | ⭐ 强制加密 |
| **浏览器支持** | 全部 | 主流浏览器 | 现代浏览器 |

### 12.17.2 HTTP/2 核心特性

```mermaid
graph LR
    subgraph HTTP/1.1
        C1[客户端] -->|请求1| S1[服务器]
        S1 -->|响应1| C1
        C1 -->|请求2| S1
        S1 -->|响应2| C1
        Note1[串行，队头阻塞]
    end
    
    subgraph HTTP/2
        C2[客户端] -->|帧交织| S2[服务器]
        S2 -->|帧交织| C2
        Note2[多路复用，并行传输]
    end
    
    style Note1 fill:#f44336,color:#fff
    style Note2 fill:#4CAF50,color:#fff
```

**HTTP/2 帧结构：**

```mermaid
graph TB
    Frame[HTTP/2 帧] --> Header[帧头 9 字节]
    Frame --> Payload[帧载荷]
    
    Header --> H1[Length: 3 字节]
    Header --> H2[Type: 1 字节]
    Header --> H3[Flags: 1 字节]
    Header --> H4[Stream ID: 4 字节]
    
    Payload --> P1[DATA 帧: 请求/响应体]
    Payload --> P2[HEADERS 帧: 头部]
    Payload --> P3[SETTINGS 帧: 配置]
    Payload --> P4[PUSH_PROMISE 帧: 服务器推送]
    Payload --> P5[PING 帧: 连接保活]
    Payload --> P6[GOAWAY 帧: 优雅关闭]
```

```javascript
// Node.js HTTP/2 服务器
import http2 from 'http2';
import fs from 'fs';

const server = http2.createSecureServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.cert')
});

server.on('stream', (stream, headers) => {
  const path = headers[':path'];
  
  // 服务器推送
  if (path === '/') {
    stream.pushStream({ ':path': '/style.css' }, (err, pushStream) => {
      if (!err) {
        pushStream.respond({ ':status': 200, 'content-type': 'text/css' });
        pushStream.end(fs.readFileSync('style.css'));
      }
    });
    
    stream.pushStream({ ':path': '/app.js' }, (err, pushStream) => {
      if (!err) {
        pushStream.respond({ ':status': 200, 'content-type': 'application/javascript' });
        pushStream.end(fs.readFileSync('app.js'));
      }
    });
  }
  
  // 正常响应
  stream.respond({ ':status': 200, 'content-type': 'text/html' });
  stream.end('<html><body>Hello HTTP/2!</body></html>');
});

server.listen(8443);
```

### 12.17.3 HTTP/3 与 QUIC 协议

```mermaid
sequenceDiagram
    participant Client as 客户端
    participant Server as 服务器
    
    Note over Client,Server: HTTP/1.1 & HTTP/2 (TCP)
    Client->>Server: TCP SYN
    Server-->>Client: TCP SYN-ACK
    Client->>Server: TCP ACK
    Client->>Server: TLS ClientHello
    Server-->>Client: TLS ServerHello
    Client->>Server: TLS Finished
    Note over Client,Server: 共 2-3 个 RTT 才能发送数据
    
    Note over Client,Server: HTTP/3 (QUIC)
    Client->>Server: QUIC Initial (含 TLS ClientHello)
    Server-->>Client: QUIC Handshake (含 TLS ServerHello)
    Client->>Server: 数据请求
    Note over Client,Server: ⭐ 0-1 个 RTT，首次即可发送数据
```

### 12.17.4 HTTP 协议选型建议

```mermaid
flowchart TD
    Start{选择 HTTP 版本} --> Q1{客户端支持 HTTP/3?}
    Q1 -->|是| Q2{网络环境?}
    Q2 -->|不稳定/移动网络| H3[✅ HTTP/3<br/>QUIC 连接迁移]
    Q2 -->|稳定/内网| Q3{需要极致性能?}
    Q3 -->|是| H3
    Q3 -->|否| H2[✅ HTTP/2]
    
    Q1 -->|否| Q4{支持 HTTP/2?}
    Q4 -->|是| H2
    Q4 -->|否| H1[HTTP/1.1]
    
    style H3 fill:#4CAF50,color:#fff
    style H2 fill:#2196F3,color:#fff
    style H1 fill:#9E9E9E,color:#fff
```

---

## 12.18 RESTful API 进阶：HATEOAS 与 GraphQL 对比

### 12.18.1 REST 成熟度模型（Richardson 模型）

| 级别 | 名称 | 特征 | 示例 |
|------|------|------|------|
| Level 0 | POX | 单一 URL + POST | `POST /api` + XML Body |
| Level 1 | 资源 | 多个 URL | `GET /users/123` |
| Level 2 | HTTP 动词 | 正确使用 GET/POST/PUT/DELETE | `DELETE /users/123` |
| Level 3 | HATEOAS | 响应中包含超链接 | `{"links": {"self": "/users/123", "orders": "/users/123/orders"}}` |

```json
// HATEOAS 响应示例
{
  "id": 123,
  "name": "张三",
  "email": "zhangsan@example.com",
  "_links": {
    "self": { "href": "/api/v1/users/123" },
    "orders": { "href": "/api/v1/users/123/orders" },
    "avatar": { "href": "/api/v1/users/123/avatar" },
    "update": { "href": "/api/v1/users/123", "method": "PATCH" },
    "delete": { "href": "/api/v1/users/123", "method": "DELETE" }
  }
}
```

### 12.18.2 REST vs GraphQL vs gRPC

| 维度 | REST | GraphQL | gRPC |
|------|------|---------|------|
| **数据获取** | 固定结构，可能过少/过多 | ⭐ 精确获取所需字段 | 固定结构（Proto 定义） |
| **请求数量** | 多个端点 → 多次请求 | ⭐ 单次请求获取关联数据 | 一对一调用 |
| **缓存** | ⭐ HTTP 缓存简单 | 需额外方案 | 需额外方案 |
| **文件上传** | ⭐ 原生支持 | 需 Base64 或 REST 辅助 | 流式传输 |
| **实时更新** | WebSocket/SSE | ⭐ Subscription 内置 | 流式 RPC |
| **学习曲线** | 低 | 中 | 中 |
| **适用场景** | 公开 API、简单 CRUD | 前端驱动、复杂数据需求 | 内部微服务 |

---

## 22. HTTP/3 与 QUIC 协议深度

### 22.1 为什么需要 HTTP/3？

HTTP/2 虽然解决了队头阻塞（应用层），但 TCP 层的队头阻塞依然存在：

| 问题 | HTTP/1.1 | HTTP/2 | HTTP/3 |
|------|----------|--------|--------|
| 应用层队头阻塞 | ✅ 严重 | ✅ 已解决 | ✅ 已解决 |
| TCP 层队头阻塞 | ✅ 存在 | ✅ 存在 | ✅ 已解决（QUIC） |
| 连接建立延迟 | 1-3 RTT | 1-3 RTT | 0-1 RTT |
| 连接迁移 | ❌ 不支持 | ❌ 不支持 | ✅ 支持 |
| 加密 | 可选 | 可选（实际强制） | 强制内置 |

### 22.2 QUIC 协议架构

QUIC（Quick UDP Internet Connections）是基于 UDP 的传输协议：

```mermaid
graph TB
    subgraph "传统 HTTP/2 协议栈"
        A1[HTTP/2] --> B1[TLS 1.2/1.3]
        B1 --> C1[TCP]
        C1 --> D1[IP]
    end

    subgraph "HTTP/3 协议栈"
        A2[HTTP/3] --> B2[QUIC]
        B2 --> C2[UDP]
        C2 --> D2[IP]
        B2 -.-> E2[内置 TLS 1.3]
        B2 -.-> F2[内置流控制]
    end
```

### 22.3 QUIC 握手流程

```mermaid
sequenceDiagram
    participant C as 客户端
    participant S as 服务器

    Note over C,S: 首次连接（1-RTT 握手）
    C->>S: Initial (ClientHello + QUIC配置)
    S->>C: Initial (ServerHello + 证书) + Handshake
    C->>S: Handshake (Finished)
    Note over C,S: 连接建立，开始传输数据

    Note over C,S: 再次连接（0-RTT 握手）
    C->>S: Initial (ClientHello + 缓存Token + 早期数据)
    Note over C,S: 立即开始传输数据（0-RTT）
    S->>C: Initial (ServerHello)
```

### 22.4 连接迁移

QUIC 使用 Connection ID 而非 IP:Port 标识连接：

```mermaid
graph LR
    subgraph "场景：WiFi → 4G 切换"
        A[手机 WiFi<br>192.168.1.100:5000] -->|连接中| B[服务器]
        C[手机 4G<br>10.0.0.50:6000] -->|Connection ID 不变<br>无缝迁移| B
    end
```

**Connection ID 的作用：**
- 唯一标识连接，不依赖 IP + 端口
- 网络切换时，客户端发送 PATH_CHALLENGE 帧
- 服务器验证新路径后回复 PATH_RESPONSE
- 连接不中断，无需重新握手

### 22.5 QUIC 多路复用改进

```mermaid
graph TB
    subgraph "HTTP/2 over TCP"
        T1[Stream 1] --> TCP[TCP 连接]
        T2[Stream 2] --> TCP
        T3[Stream 3] --> TCP
        TCP -->|一个包丢失<br>所有流阻塞| BLOCKED[❌ 全部阻塞]
    end

    subgraph "HTTP/3 over QUIC"
        Q1[Stream 1] --> QUIC[QUIC 连接]
        Q2[Stream 2] --> QUIC
        Q3[Stream 3] --> QUIC
        QUIC -->|Stream 2 丢包<br>只阻塞 Stream 2| PARTIAL[✅ 其他流继续]
    end
```

### 22.6 0-RTT 与安全考量

```javascript
// Node.js - HTTP/3 服务器示例（使用 @aspect-build/rules_js）
const http3 = require('http3');

const server = http3.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.cert'),
  // 启用 0-RTT
  enableEarlyData: true
});

server.on('stream', (stream) => {
  // 检查是否为 0-RTT 数据
  if (stream.isEarlyData) {
    console.log('收到 0-RTT 早期数据');
    // ⚠️ 注意：0-RTT 数据可能被重放！
    // 只处理幂等请求
    if (stream.headers[':method'] !== 'GET') {
      stream.respond({ ':status': 425 });
      stream.end('Too Early');
      return;
    }
  }

  stream.respond({ ':status': 200 });
  stream.end('Hello HTTP/3!');
});

server.listen(4433);
```

**0-RTT 安全风险：**

| 风险 | 说明 | 缓解措施 |
|------|------|----------|
| 重放攻击 | 攻击者可重放 0-RTT 数据 | 只对幂等请求启用 0-RTT |
| 缺乏前向保密 | 0-RTT 使用 PSK，非临时密钥 | 限制 0-RTT 数据敏感度 |
| 无服务器确认 | 服务器可能未收到 0-RTT | 关键操作等握手完成 |

### 22.7 QUIC 流量控制

```mermaid
graph TB
    subgraph "连接级流控"
        A[连接级窗口<br>所有流共享] --> B[Stream 1]
        A --> C[Stream 2]
        A --> D[Stream 3]
    end

    subgraph "流级流控"
        B --> E[Stream 1 独立窗口]
        C --> F[Stream 2 独立窗口]
        D --> G[Stream 3 独立窗口]
    end
```

### 22.8 HTTP/3 实际部署

```nginx
# Nginx HTTP/3 配置
server {
    listen 443 quic reuseport;
    listen 443 ssl;

    ssl_certificate     /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;

    # 告知客户端支持 HTTP/3
    add_header Alt-Svc 'h3=":443"; ma=86400';

    # HTTP/3 设置
    quic_gso on;
    quic_retry on;

    location / {
        root /var/www/html;
    }
}
```

```bash
# 测试 HTTP/3 连接
curl --http3 https://example.com -v

# 使用 quic-go 客户端
go run github.com/quic-go/quic-go/tools/qpack -request https://example.com
```

---

## 23. gRPC 深度

### 23.1 gRPC 概述

gRPC 是 Google 开发的高性能 RPC 框架，基于 HTTP/2 和 Protocol Buffers：

```mermaid
graph LR
    subgraph "gRPC 客户端"
        A[应用代码] --> B[Stub/Client]
        B --> C[Protobuf 编码]
    end

    subgraph "传输层"
        C --> D[HTTP/2]
        D --> E[TCP/TLS]
    end

    subgraph "gRPC 服务端"
        E --> F[Protobuf 解码]
        F --> G[Server 实现]
    end
```

**gRPC vs REST 对比：**

| 特性 | gRPC | REST |
|------|------|------|
| 协议 | HTTP/2 | HTTP/1.1（通常） |
| 数据格式 | Protobuf（二进制） | JSON（文本） |
| 性能 | 高（序列化快，体积小） | 中等 |
| 浏览器支持 | 需要 gRPC-Web | 原生支持 |
| 流式传输 | 原生支持 | 需要 WebSocket |
| API 定义 | .proto 文件 | OpenAPI/Swagger |
| 代码生成 | 自动生成 | 手动或工具生成 |

### 23.2 Protocol Buffers 编解码

```protobuf
// user.proto
syntax = "proto3";

package user;

option go_package = "github.com/example/user";

// 用户服务定义
service UserService {
  // 一元 RPC
  rpc GetUser(GetUserRequest) returns (User);

  // 服务端流式 RPC
  rpc ListUsers(ListUsersRequest) returns (stream User);

  // 客户端流式 RPC
  rpc CreateUser(stream CreateUserRequest) returns (CreateUserResponse);

  // 双向流式 RPC
  rpc Chat(stream ChatMessage) returns (stream ChatMessage);
}

message GetUserRequest {
  int32 id = 1;
}

message User {
  int32 id = 1;
  string name = 2;
  string email = 3;
  UserStatus status = 4;
  repeated string roles = 5;
  map<string, string> metadata = 6;
}

enum UserStatus {
  USER_STATUS_UNSPECIFIED = 0;
  USER_STATUS_ACTIVE = 1;
  USER_STATUS_INACTIVE = 2;
}

message ListUsersRequest {
  int32 page_size = 1;
  string page_token = 2;
}

message CreateUserRequest {
  string name = 1;
  string email = 2;
}

message CreateUserResponse {
  User user = 1;
}

message ChatMessage {
  string sender = 1;
  string content = 2;
  int64 timestamp = 3;
}
```

**Protobuf 编码原理：**

```mermaid
graph LR
    subgraph "Protobuf 编码"
        A["{id: 1, name: 'Alice'}"] --> B[Varint 编码]
        B --> C[字段编号+类型 标签]
        C --> D[紧凑二进制]
    end

    subgraph "JSON 编码"
        E['{"id":1,"name":"Alice"}'] --> F[UTF-8 文本]
    end
```

| 编码方式 | 数据大小 | 序列化速度 | 可读性 |
|----------|----------|------------|--------|
| Protobuf | ~20 字节 | 极快 | ❌ 二进制 |
| JSON | ~27 字节 | 中等 | ✅ 文本 |
| XML | ~50+ 字节 | 慢 | ✅ 文本 |

### 23.3 四种通信模式

```mermaid
sequenceDiagram
    participant C as 客户端
    participant S as 服务端

    Note over C,S: 模式1：一元 RPC (Unary)
    C->>S: 请求
    S->>C: 响应

    Note over C,S: 模式2：服务端流式 (Server Streaming)
    C->>S: 请求
    S->>C: 响应流 1
    S->>C: 响应流 2
    S->>C: 响应流 3
    S->>C: 完成

    Note over C,S: 模式3：客户端流式 (Client Streaming)
    C->>S: 请求流 1
    C->>S: 请求流 2
    C->>S: 请求流 3
    C->>S: 完成
    S->>C: 响应

    Note over C,S: 模式4：双向流式 (Bidirectional)
    C->>S: 请求流 1
    S->>C: 响应流 1
    C->>S: 请求流 2
    S->>C: 响应流 2
    C->>S: 完成
    S->>C: 完成
```

### 23.4 Go gRPC 服务端实现

```go
package main

import (
    "context"
    "fmt"
    "io"
    "log"
    "net"

    pb "github.com/example/user/proto"
    "google.golang.org/grpc"
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/metadata"
    "google.golang.org/grpc/status"
)

type userServer struct {
    pb.UnimplementedUserServiceServer
    users map[int32]*pb.User
}

// 一元 RPC
func (s *userServer) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.User, error) {
    // 从 metadata 获取认证信息
    md, ok := metadata.FromIncomingContext(ctx)
    if ok {
        token := md.Get("authorization")
        log.Printf("Authorization: %v", token)
    }

    user, exists := s.users[req.Id]
    if !exists {
        return nil, status.Errorf(codes.NotFound, "用户 %d 不存在", req.Id)
    }
    return user, nil
}

// 服务端流式 RPC
func (s *userServer) ListUsers(req *pb.ListUsersRequest, stream pb.UserService_ListUsersServer) error {
    for _, user := range s.users {
        if err := stream.Send(user); err != nil {
            return err
        }
    }
    return nil
}

// 客户端流式 RPC
func (s *userServer) CreateUser(stream pb.UserService_CreateUserServer) error {
    var created []*pb.User
    for {
        req, err := stream.Recv()
        if err == io.EOF {
            return stream.SendAndClose(&pb.CreateUserResponse{
                User: created[len(created)-1],
            })
        }
        if err != nil {
            return err
        }
        id := int32(len(s.users) + 1)
        user := &pb.User{Id: id, Name: req.Name, Email: req.Email}
        s.users[id] = user
        created = append(created, user)
    }
}

// 双向流式 RPC
func (s *userServer) Chat(stream pb.UserService_ChatServer) error {
    for {
        msg, err := stream.Recv()
        if err == io.EOF {
            return nil
        }
        if err != nil {
            return err
        }
        // 回显消息
        reply := &pb.ChatMessage{
            Sender:    "Server",
            Content:   fmt.Sprintf("收到: %s", msg.Content),
            Timestamp: msg.Timestamp,
        }
        if err := stream.Send(reply); err != nil {
            return err
        }
    }
}

func main() {
    lis, err := net.Listen("tcp", ":50051")
    if err != nil {
        log.Fatalf("监听失败: %v", err)
    }

    s := grpc.NewServer(
    // 拦截器示例见下文
    )
    pb.RegisterUserServiceServer(s, &userServer{
        users: make(map[int32]*pb.User),
    })

    log.Println("gRPC 服务启动，监听 :50051")
    if err := s.Serve(lis); err != nil {
        log.Fatalf("服务失败: %v", err)
    }
}
```

### 23.5 Node.js gRPC 客户端实现

```javascript
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

// 加载 proto 文件
const packageDef = protoLoader.loadSync('user.proto', {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDef).user;

// 创建客户端
const client = new proto.UserService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

// 一元 RPC
client.GetUser({ id: 1 }, (err, response) => {
  if (err) {
    console.error('错误:', err.details);
    return;
  }
  console.log('用户:', response);
});

// 服务端流式 RPC
const stream = client.ListUsers({ page_size: 10 });
stream.on('data', (user) => {
  console.log('收到用户:', user.name);
});
stream.on('end', () => {
  console.log('流结束');
});
stream.on('error', (err) => {
  console.error('流错误:', err);
});

// 客户端流式 RPC
const createStream = client.CreateUser((err, response) => {
  if (err) console.error(err);
  else console.log('创建完成:', response);
});
createStream.write({ name: 'Alice', email: 'alice@example.com' });
createStream.write({ name: 'Bob', email: 'bob@example.com' });
createStream.end();

// 双向流式 RPC
const chatStream = client.Chat();
chatStream.on('data', (msg) => {
  console.log(`[${msg.sender}]: ${msg.content}`);
});
chatStream.write({ sender: 'Client', content: '你好！' });
chatStream.write({ sender: 'Client', content: '这是测试消息' });
chatStream.end();
```

### 23.6 gRPC 拦截器

```go
// Go 一元拦截器 - 日志
func loggingInterceptor(
    ctx context.Context,
    req interface{},
    info *grpc.UnaryServerInfo,
    handler grpc.UnaryHandler,
) (interface{}, error) {
    start := time.Now()

    // 调用实际处理函数
    resp, err := handler(ctx, req)

    // 记录日志
    log.Printf("方法=%s 耗时=%v 错误=%v",
        info.FullMethod,
        time.Since(start),
        err,
    )

    return resp, err
}

// Go 一元拦截器 - 认证
func authInterceptor(
    ctx context.Context,
    req interface{},
    info *grpc.UnaryServerInfo,
    handler grpc.UnaryHandler,
) (interface{}, error) {
    // 跳过健康检查等公开方法
    if info.FullMethod == "/grpc.health.v1.Health/Check" {
        return handler(ctx, req)
    }

    md, ok := metadata.FromIncomingContext(ctx)
    if !ok {
        return nil, status.Errorf(codes.Unauthenticated, "缺少 metadata")
    }

    tokens := md.Get("authorization")
    if len(tokens) == 0 {
        return nil, status.Errorf(codes.Unauthenticated, "缺少认证令牌")
    }

    if !validateToken(tokens[0]) {
        return nil, status.Errorf(codes.Unauthenticated, "令牌无效")
    }

    return handler(ctx, req)
}

// 注册拦截器链
s := grpc.NewServer(
    grpc.ChainUnaryInterceptor(
        loggingInterceptor,
        authInterceptor,
        recoveryInterceptor, // panic 恢复
    ),
)
```

### 23.7 gRPC 错误处理

```go
// 定义错误
func (s *userServer) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.User, error) {
    if req.Id <= 0 {
        return nil, status.Errorf(codes.InvalidArgument, "用户 ID 必须大于 0，收到: %d", req.Id)
    }

    user, exists := s.users[req.Id]
    if !exists {
        return nil, status.Errorf(codes.NotFound, "用户 %d 不存在", req.Id)
    }

    return user, nil
}

// 带详细信息的错误
func detailedError() error {
    st := status.New(codes.InvalidArgument, "请求参数无效")
    // 添加详细信息
    detailed, err := st.WithDetails(
        &errdetails.BadRequest_FieldViolation{
            Field:       "email",
            Description: "邮箱格式不正确",
        },
    )
    if err != nil {
        return st.Err()
    }
    return detailed.Err()
}
```

**gRPC 状态码对照表：**

| 状态码 | 数值 | 含义 | HTTP 等价 |
|--------|------|------|-----------|
| OK | 0 | 成功 | 200 |
| CANCELLED | 1 | 被客户端取消 | 499 |
| UNKNOWN | 2 | 未知错误 | 500 |
| INVALID_ARGUMENT | 3 | 参数无效 | 400 |
| DEADLINE_EXCEEDED | 4 | 超时 | 504 |
| NOT_FOUND | 5 | 资源不存在 | 404 |
| ALREADY_EXISTS | 6 | 资源已存在 | 409 |
| PERMISSION_DENIED | 7 | 权限不足 | 403 |
| RESOURCE_EXHAUSTED | 8 | 资源耗尽 | 429 |
| UNAUTHENTICATED | 16 | 未认证 | 401 |

---

## 24. GraphQL 深度

### 24.1 GraphQL 核心概念

```mermaid
graph TB
    subgraph "GraphQL 架构"
        A[客户端] -->|查询语言| B[GraphQL 服务端]
        B --> C[Schema 定义]
        C --> D[Query 查询]
        C --> E[Mutation 变更]
        C --> F[Subscription 订阅]
        B --> G[Resolver 解析器]
        G --> H[数据源]
    end
```

### 24.2 Schema 定义

```graphql
# schema.graphql
scalar DateTime

type Query {
  user(id: ID!): User
  users(filter: UserFilter, limit: Int = 10): [User!]!
  post(id: ID!): Post
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
  deletePost(id: ID!): Boolean!
}

type Subscription {
  postCreated: Post!
  userStatusChanged(userId: ID!): User!
}

type User {
  id: ID!
  name: String!
  email: String!
  posts: [Post!]!       # 关联查询
  createdAt: DateTime!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  comments: [Comment!]!
}

type Comment {
  id: ID!
  text: String!
  author: User!
}

input CreateUserInput {
  name: String!
  email: String!
}

input UpdateUserInput {
  name: String
  email: String
}

input UserFilter {
  name: String
  email: String
  status: UserStatus
}

enum UserStatus {
  ACTIVE
  INACTIVE
  BANNED
}
```

### 24.3 N+1 问题与 DataLoader

```mermaid
sequenceDiagram
    participant C as 客户端
    participant G as GraphQL
    participant DB as 数据库

    Note over C,DB: ❌ 无 DataLoader（N+1 问题）
    C->>G: 查询 10 篇文章及作者
    G->>DB: SELECT * FROM posts (1次)
    G->>DB: SELECT * FROM users WHERE id=1
    G->>DB: SELECT * FROM users WHERE id=2
    G->>DB: ... (共 10 次查询)
    Note over DB: 共 11 次查询！

    Note over C,DB: ✅ 使用 DataLoader
    C->>G: 查询 10 篇文章及作者
    G->>DB: SELECT * FROM posts (1次)
    G->>DB: SELECT * FROM users WHERE id IN (1,2,...,10) (1次)
    Note over DB: 共 2 次查询！
```

```javascript
// Node.js DataLoader 实现
const DataLoader = require('dataloader');

// 创建用户加载器
const userLoader = new DataLoader(async (userIds) => {
  // 批量查询，返回顺序必须与 userIds 一致
  const users = await db.query(
    'SELECT * FROM users WHERE id IN (?)',
    [userIds]
  );

  const userMap = new Map(users.map(u => [u.id, u]));
  return userIds.map(id => userMap.get(id) || null);
});

// Resolver 使用
const resolvers = {
  Post: {
    author: (post) => userLoader.load(post.authorId), // 自动批处理
  },
};
```

### 24.4 Schema 拼接与 Federation

```mermaid
graph TB
    subgraph "Apollo Federation 架构"
        GW[Gateway 网关] --> US[用户服务]
        GW --> PS[文章服务]
        GW --> CS[评论服务]

        US -->|@key: User| UDB[(用户数据库)]
        PS -->|@key: Post<br>extends User| PDB[(文章数据库)]
        CS -->|extends Post, User| CDB[(评论数据库)]
    end
```

```graphql
# 用户服务 Schema
type User @key(fields: "id") {
  id: ID!
  name: String!
  email: String!
}

# 文章服务 Schema（扩展 User）
extend type User @key(fields: "id") {
  id: ID! @external
  posts: [Post!]!
}

type Post @key(fields: "id") {
  id: ID!
  title: String!
  content: String!
  author: User!
}

# 评论服务 Schema（扩展 Post 和 User）
extend type Post @key(fields: "id") {
  id: ID! @external
  comments: [Comment!]!
}

extend type User @key(fields: "id") {
  id: ID! @external
  comments: [Comment!]!
}
```

### 24.5 GraphQL 订阅（Subscription）

```javascript
const { PubSub } = require('graphql-subscriptions');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/lib/use/ws');

const pubsub = new PubSub();

const resolvers = {
  Subscription: {
    postCreated: {
      subscribe: () => pubsub.asyncIterator(['POST_CREATED']),
    },
    userStatusChanged: {
      subscribe: (_, { userId }) => {
        return pubsub.asyncIterator([`USER_STATUS_${userId}`]);
      },
    },
  },
  Mutation: {
    createPost: async (_, { input }, context) => {
      const post = await context.db.posts.create(input);
      pubsub.publish('POST_CREATED', { postCreated: post });
      return post;
    },
  },
};

// WebSocket 服务器
const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql',
});

useServer({ schema, execute, subscribe }, wsServer);
```

### 24.6 GraphQL 性能优化

```javascript
// 查询深度限制
const depthLimit = require('graphql-depth-limit');

const server = new ApolloServer({
  schema,
  validationRules: [depthLimit(7)], // 最大查询深度 7 层
});

// 查询复杂度分析
const { createComplexityRule } = require('graphql-query-complexity');

const rule = createComplexityRule({
  maximumComplexity: 1000,
  estimators: [
    fieldExtensionsEstimator(),
    simpleEstimator({ defaultComplexity: 1 }),
  ],
  onComplete: (complexity) => {
    console.log('查询复杂度:', complexity);
  },
});

// 持久化查询（减少传输大小）
const server = new ApolloServer({
  schema,
  persistedQueries: {
    cache: new Map(), // 生产环境用 Redis
  },
});
```

---

## 25. API 安全

### 25.1 OAuth 2.0 授权流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant C as 客户端应用
    participant A as 授权服务器
    participant R as 资源服务器

    Note over U,R: 授权码模式 (Authorization Code)
    C->>U: 重定向到授权页面
    U->>A: 登录并授权
    A->>C: 返回授权码 (code)
    C->>A: 用 code 换取 access_token
    A->>C: 返回 access_token + refresh_token
    C->>R: 携带 access_token 请求资源
    R->>C: 返回受保护资源

    Note over U,R: PKCE 模式（移动端/SPA）
    C->>C: 生成 code_verifier + code_challenge
    C->>A: 带 code_challenge 请求授权
    A->>C: 返回授权码
    C->>A: 用 code + code_verifier 换 token
    A->>C: 验证后返回 token
```

### 25.2 JWT 详解

```mermaid
graph LR
    subgraph "JWT 结构"
        A["Header<br>{alg:'HS256',typ:'JWT'}"] --> D[Base64URL 编码]
        B["Payload<br>{sub:'123',name:'Alice',exp:1234567890}"] --> E[Base64URL 编码]
        C["Signature<br>HMACSHA256(header+'.'+payload, secret)"] --> F[签名]
        D --> G[xxxxx.yyyyy.zzzzz]
        E --> G
        F --> G
    end
```

```javascript
// Node.js JWT 实现
const jwt = require('jsonwebtoken');

// 生成 JWT
const token = jwt.sign(
  {
    sub: '12345',
    name: 'Alice',
    roles: ['admin', 'user'],
    iat: Math.floor(Date.now() / 1000),
  },
  process.env.JWT_SECRET,
  {
    expiresIn: '1h',        // 过期时间
    issuer: 'my-app',       // 签发者
    audience: 'my-api',     // 受众
  }
);

// 验证 JWT
try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET, {
    issuer: 'my-app',
    audience: 'my-api',
  });
  console.log('用户:', decoded.name);
} catch (err) {
  if (err.name === 'TokenExpiredError') {
    console.log('令牌已过期');
  } else {
    console.log('令牌无效');
  }
}

// Express 中间件
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '缺少认证令牌' });
  }

  try {
    const token = authHeader.slice(7);
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: '令牌无效或已过期' });
  }
}
```

### 25.3 API Key 管理

```javascript
// API Key 生成与验证
const crypto = require('crypto');

// 生成 API Key
function generateApiKey() {
  const prefix = 'sk_live_'; // 标识环境
  const random = crypto.randomBytes(32).toString('hex');
  return `${prefix}${random}`;
}

// 存储时只保存哈希
function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Express API Key 验证中间件
async function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: '缺少 API Key' });
  }

  const hashed = hashApiKey(apiKey);
  const keyRecord = await db.apiKeys.findByHash(hashed);

  if (!keyRecord || !keyRecord.active) {
    return res.status(401).json({ error: 'API Key 无效' });
  }

  // 检查速率限制
  const usage = await redis.incr(`api_usage:${keyRecord.id}`);
  if (usage > keyRecord.rateLimit) {
    return res.status(429).json({ error: '请求过于频繁' });
  }
  await redis.expire(`api_usage:${keyRecord.id}`, 60);

  req.apiKey = keyRecord;
  next();
}
```

### 25.4 速率限制实现

```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

// 基于 IP 的速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100,                  // 每个 IP 最多 100 次请求
  standardHeaders: true,     // 返回 RateLimit-* 头
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
  // 使用 Redis 存储（多实例部署）
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }),
});

// 不同端点不同限制
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 登录尝试限制更严格
  message: { error: '登录尝试过多，请 15 分钟后再试' },
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
```

### 25.5 OWASP API Security Top 10 (2023)

| 排名 | 风险 | 说明 | 防护措施 |
|------|------|------|----------|
| API1 | 对象级别授权失效 | 用户可访问其他用户的资源 | 每次请求验证对象所有权 |
| API2 | 认证机制失效 | 弱密码策略、令牌泄露 | MPC、短令牌、密钥轮换 |
| API3 | 对象属性级别授权失效 | 用户可修改只读字段 | 白名单验证可写字段 |
| API4 | 资源消耗不受限 | 无速率限制、无分页限制 | 实施速率限制和分页 |
| API5 | 功能级别授权失效 | 普通用户访问管理接口 | RBAC + 路由级别鉴权 |
| API6 | 敏感业务流无访问限制 | 批量操作、自动化滥用 | CAPTCHA、行为分析 |
| API7 | 服务端请求伪造 (SSRF) | 服务端发起未授权请求 | URL 白名单、禁止内网访问 |
| API8 | 安全配置错误 | 默认凭据、详细错误信息 | 最小权限、错误信息脱敏 |
| API9 | 资产管理不当 | 废弃 API 未下线 | API 清单管理、版本控制 |
| API10 | 不安全的消费端 API | 第三方 API 信任过度 | 输入验证、异常处理 |

### 25.6 输入验证

```javascript
const Joi = require('joi');

// 定义验证规则
const userSchema = Joi.object({
  name: Joi.string().min(2).max(50).required()
    .messages({
      'string.min': '名称至少 2 个字符',
      'string.max': '名称最多 50 个字符',
      'any.required': '名称是必填项',
    }),
  email: Joi.string().email().required(),
  age: Joi.number().integer().min(0).max(150).optional(),
  role: Joi.string().valid('admin', 'user', 'moderator').default('user'),
});

// Express 验证中间件
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,      // 返回所有错误
      stripUnknown: true,     // 移除未知字段
    });

    if (error) {
      return res.status(400).json({
        error: '参数验证失败',
        details: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
    }

    req.body = value; // 使用验证后的值
    next();
  };
}

app.post('/users', validate(userSchema), (req, res) => {
  // req.body 已经过验证和清洗
});
```

---

## 26. 网络调试实战

### 26.1 tcpdump 常用过滤器

```bash
# 捕获特定主机的流量
tcpdump -i eth0 host 192.168.1.100

# 捕获特定端口（HTTP）
tcpdump -i eth0 port 80

# 捕获 TCP SYN 包（新连接）
tcpdump -i eth0 'tcp[tcpflags] & tcp-syn != 0'

# 捕获 HTTP GET 请求
tcpdump -i eth0 -A 'tcp port 80 and (((ip[2:2] - ((ip[0]&0xf)<<2)) - ((tcp[12]&0xf0)>>2)) != 0)' | grep "GET "

# 捕获 DNS 查询
tcpdump -i eth0 port 53

# 捕获并保存到文件（可用 Wireshark 打开）
tcpdump -i eth0 -w capture.pcap port 443

# 读取 pcap 文件
tcpdump -r capture.pcap

# 限制捕获数量
tcpdump -i eth0 -c 100 port 80

# 显示详细信息
tcpdump -i eth0 -vvv port 80

# 捕获特定网段
tcpdump -i eth0 net 10.0.0.0/24

# 捕获 ICMP（ping）
tcpdump -i eth0 icmp

# 组合过滤：特定主机的 HTTP 流量
tcpdump -i eth0 'host 10.0.0.1 and tcp port 80'

# 捕获 RST 包（连接重置）
tcpdump -i eth0 'tcp[tcpflags] & tcp-rst != 0'

# 按时间范围捕获
tcpdump -i eth0 -G 3600 -w 'capture-%Y%m%d%H%M%S.pcap' port 80
```

### 26.2 Wireshark 过滤器速查表

**捕获过滤器（BPF 语法）：**

| 过滤器 | 说明 |
|--------|------|
| `host 192.168.1.1` | 特定主机 |
| `net 192.168.1.0/24` | 特定网段 |
| `port 80` | 特定端口 |
| `portrange 8000-9000` | 端口范围 |
| `tcp` | 仅 TCP |
| `udp` | 仅 UDP |
| `icmp` | 仅 ICMP |
| `src host 10.0.0.1` | 源地址 |
| `dst port 443` | 目标端口 |
| `tcp port 80 and host 10.0.0.1` | 组合条件 |

**显示过滤器（Wireshark 语法）：**

| 过滤器 | 说明 |
|--------|------|
| `http` | HTTP 协议 |
| `http.request.method == "GET"` | GET 请求 |
| `http.response.code == 200` | 200 响应 |
| `tcp.analysis.retransmission` | TCP 重传 |
| `tcp.analysis.zero_window` | 零窗口 |
| `dns` | DNS 查询 |
| `ip.addr == 10.0.0.1` | IP 地址 |
| `tcp.port == 443` | TCP 端口 |
| `tls.handshake` | TLS 握手 |
| `http contains "error"` | HTTP 包含 "error" |
| `frame.time > "2024-01-01"` | 时间过滤 |
| `tcp.stream eq 5` | 特定 TCP 流 |

### 26.3 Chrome DevTools Network 面板详解

```mermaid
graph TB
    subgraph "Network 面板功能区"
        A[Filter 过滤栏] --> B[请求列表]
        B --> C[Timing 时间线]
        B --> D[Headers 头信息]
        B --> E[Preview 预览]
        B --> F[Response 响应体]
        B --> G[Cookies]
        B --> H[Initiator 请求来源]
    end
```

**Network 面板关键指标：**

| 指标 | 含义 | 优化方向 |
|------|------|----------|
| Queued | 排队等待时间 | 减少并发请求数 |
| Stalled | 连接前等待 | 减少域名分片 |
| DNS Lookup | DNS 解析 | 使用 DNS 预解析 |
| Initial Connection | TCP 连接 | 使用 Keep-Alive |
| SSL/TLS | TLS 协商 | 使用 TLS 1.3、会话恢复 |
| TTFB (Time To First Byte) | 首字节时间 | 优化服务端响应 |
| Content Download | 内容下载 | 压缩资源、CDN |

**常用过滤语法：**

```
# 按类型过滤
# 文档、CSS、JS、图片、XHR、WebSocket 等

# 按状态码
status-code:404

# 按资源大小
larger-than:100k

# 按域名
domain:api.example.com

# 按请求方法
method:POST

# 按时间
larger-than:500ms

# 组合过滤
status-code:200 larger-than:100k method:GET
```

---

## 27. 网络性能优化

### 27.1 TCP 优化

```mermaid
graph TB
    subgraph "TCP 优化策略"
        A[TCP 优化] --> B[TCP Fast Open]
        A --> C[增大初始拥塞窗口]
        A --> D[TCP_NODELAY]
        A --> E[连接池]
        A --> F[Keep-Alive]
    end
```

```nginx
# Nginx TCP 优化
http {
    # 启用 TCP Fast Open
    listen 80 fastopen=256;

    # 连接超时
    keepalive_timeout 65;
    keepalive_requests 1000;

    # TCP 缓冲区
    tcp_nodelay on;
    tcp_nopush on;

    # 发送文件
    sendfile on;

    # 缓冲区大小
    client_body_buffer_size 10K;
    client_header_buffer_size 1k;
    client_max_body_size 8m;
    large_client_header_buffers 4 4k;
}
```

### 27.2 TLS 1.3 优化

```mermaid
sequenceDiagram
    participant C as 客户端
    participant S as 服务器

    Note over C,S: TLS 1.2（2-RTT）
    C->>S: ClientHello
    S->>C: ServerHello + Certificate
    C->>S: ClientKeyExchange + Finished
    S->>C: Finished
    Note over C,S: 开始传输数据

    Note over C,S: TLS 1.3（1-RTT）
    C->>S: ClientHello + KeyShare
    S->>C: ServerHello + KeyShare + EncryptedExtensions
    Note over C,S: 立即开始加密传输
```

```nginx
# Nginx TLS 1.3 配置
server {
    listen 443 ssl http2;

    ssl_protocols TLSv1.3 TLSv1.2;
    ssl_prefer_server_ciphers off;

    # TLS 1.3 0-RTT
    ssl_early_data on;

    # 会话恢复
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets on;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;

    # 证书
    ssl_certificate /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;
}
```

### 27.3 HTTP/2 多路复用优化

```javascript
// Node.js HTTP/2 服务器
const http2 = require('http2');
const fs = require('fs');

const server = http2.createSecureServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.cert'),
  // 优化设置
  settings: {
    headerTableSize: 4096,
    initialWindowSize: 1048576,  // 1MB
    maxConcurrentStreams: 100,
    maxFrameSize: 16384,
  },
});

server.on('stream', (stream, headers) => {
  // 多路复用：每个流独立处理
  stream.pushStream({ ':path': '/style.css' }, (err, pushStream) => {
    pushStream.respond({ ':status': 200, 'content-type': 'text/css' });
    pushStream.end(fs.readFileSync('style.css'));
  });

  stream.respond({ ':status': 200, 'content-type': 'text/html' });
  stream.end(fs.readFileSync('index.html'));
});
```

### 27.4 连接复用策略

```javascript
// Node.js HTTP Agent 连接池
const http = require('http');
const https = require('https');

// HTTP 连接池
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,      // Keep-Alive 超时
  maxSockets: 100,            // 每个主机最大连接数
  maxFreeSockets: 10,         // 空闲连接保留数
  timeout: 60000,             // 连接超时
});

// HTTPS 连接池
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 5,
  timeout: 60000,
  // TLS 会话复用
  secureOptions: require('constants').SSL_OP_NO_TICKET,
});

// 使用连接池
async function fetchWithPool(url) {
  const agent = url.startsWith('https') ? httpsAgent : httpAgent;
  return fetch(url, { agent });
}
```

### 27.5 Keep-Alive 最佳实践

```nginx
# Nginx Keep-Alive 优化
upstream backend {
    server 127.0.0.1:3000;
    keepalive 32;                    # 保持 32 个空闲连接
    keepalive_timeout 60s;           # 空闲超时
    keepalive_requests 1000;         # 每个连接最大请求数
}

server {
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;                   # 必须使用 HTTP/1.1
        proxy_set_header Connection "";            # 清除 Connection: close
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### 27.6 压缩优化

```nginx
# Brotli + Gzip 压缩
http {
    # Brotli（比 Gzip 小 20-30%）
    brotli on;
    brotli_comp_level 6;
    brotli_types text/plain text/css application/json application/javascript text/xml;

    # Gzip（兼容性更好）
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 256;
}
```

---

## 28. 网络协议综合对比

### 28.1 协议选型决策树

```mermaid
graph TD
    A[需要什么类型的通信？] --> B{实时双向？}
    B -->|是| C{需要低延迟？}
    C -->|是| D[gRPC 双向流]
    C -->|否| E[WebSocket]

    B -->|否| F{数据复杂度？}
    F -->|复杂查询| G[GraphQL]
    F -->|简单 CRUD| H{性能要求？}

    H -->|高性能| I[gRPC]
    H -->|通用| J[REST API]

    K[移动端？] -->|是| L{需要 0-RTT？}
    L -->|是| M[HTTP/3 + QUIC]
    L -->|否| N[HTTP/2]
```

### 28.2 性能对比表

| 指标 | REST/JSON | gRPC/Protobuf | GraphQL | WebSocket |
|------|-----------|---------------|---------|-----------|
| 延迟 | 中等 | 低 | 中等 | 低 |
| 带宽 | 高 | 低 | 可优化 | 低 |
| 浏览器支持 | ✅ 原生 | ❌ 需要 gRPC-Web | ✅ 原生 | ✅ 原生 |
| 类型安全 | ❌ 无 | ✅ 强 | ✅ Schema | ❌ 无 |
| 学习曲线 | 低 | 中等 | 中等 | 低 |
| 流式传输 | ❌ | ✅ 原生 | ✅ Subscription | ✅ 原生 |
| 工具生态 | 丰富 | 丰富 | 丰富 | 中等 |
| 适用场景 | 通用 API | 微服务内部 | 复杂数据查询 | 实时应用 |

---

> **学习建议**：网络协议是后端开发的基石。建议先掌握 HTTP/2 和 gRPC，再学习 GraphQL 和 HTTP/3。通过实际抓包工具（tcpdump/Wireshark）观察协议行为，加深理解。安全方面，OWASP API Top 10 是必读清单。

---

## 29. 网络调试进阶工具

### 29.1 curl 高级用法

```bash
# 详细输出（包含 TLS 握手信息）
curl -v https://api.example.com/users

# 仅显示响应头
curl -I https://api.example.com

# 显示详细时间统计
curl -w "\n\
  DNS解析:       %{time_namelookup}s\n\
  TCP连接:       %{time_connect}s\n\
  TLS握手:       %{time_appconnect}s\n\
  首字节时间:    %{time_starttransfer}s\n\
  总耗时:        %{time_total}s\n\
  下载大小:      %{size_download} bytes\n\
  HTTP状态码:    %{http_code}\n\
" -o /dev/null -s https://api.example.com

# 模拟特定 User-Agent
curl -A "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)" https://example.com

# 跟踪重定向
curl -L -v https://example.com/redirect

# 发送 JSON POST 请求
curl -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token123" \
  -d '{"name":"Alice","email":"alice@test.com"}'

# 上传文件
curl -X POST https://api.example.com/upload \
  -F "file=@./photo.jpg" \
  -F "description=My photo"

# 使用代理
curl -x http://proxy:8080 https://api.example.com

# 限速下载（测试慢网络）
curl --limit-rate 100K -O https://example.com/large-file.zip

# 并发请求（curl 7.66+）
curl --parallel --parallel-max 10 \
  https://api.example.com/users/1 \
  https://api.example.com/users/2 \
  https://api.example.com/users/3
```

### 29.2 httpie 交互式调试

```bash
# 安装
pip install httpie

# GET 请求
http GET https://api.example.com/users

# POST JSON
http POST https://api.example.com/users \
  name=Alice \
  email=alice@test.com \
  Authorization:"Bearer token123"

# 文件上传
http --form POST https://api.example.com/upload file@./photo.jpg

# 下载文件
http --download https://example.com/file.zip

# 只看响应头
http --headers https://api.example.com

# 会话保持（自动管理 Cookie）
http --session=mysession https://api.example.com/login username=admin password=secret
http --session=mysession https://api.example.com/dashboard
```

### 29.3 常见网络问题诊断流程

```mermaid
graph TD
    A[网络请求失败] --> B{DNS 解析正常？}
    B -->|否| C[检查 DNS 配置<br>dig/nslookup]
    B -->|是| D{TCP 连接成功？}
    D -->|否| E[检查端口/防火墙<br>telnet/nc]
    D -->|是| F{TLS 握手成功？}
    F -->|否| G[检查证书/协议版本<br>openssl s_client]
    F -->|是| H{HTTP 响应正常？}
    H -->|否| I[检查服务端日志<br>curl -v]
    H -->|是| J{响应内容正确？}
    J -->|否| K[检查 API 文档<br>参数/认证]
    J -->|是| L[✅ 正常]
```

```bash
# DNS 诊断
dig api.example.com +short
dig api.example.com @8.8.8.8  # 使用 Google DNS
nslookup api.example.com

# TCP 连接测试
telnet api.example.com 443
nc -zv api.example.com 443

# TLS 诊断
openssl s_client -connect api.example.com:443 -servername api.example.com
openssl s_client -connect api.example.com:443 -tls1_3

# 路由追踪
traceroute api.example.com
mtr api.example.com

# 端口扫描
nmap -sT -p 80,443 api.example.com
```

### 29.4 网络性能基准测试

```bash
# ab (Apache Bench)
ab -n 1000 -c 10 -k https://api.example.com/

# wrk
wrk -t4 -c100 -d30s https://api.example.com/

# hey
hey -n 1000 -c 50 -m GET https://api.example.com/

# vegeta（更灵活的负载测试）
echo "GET https://api.example.com/users" | \
  vegeta attack -duration=30s -rate=100 | \
  vegeta report -type=text
```

---

## 30. 实战案例：构建高性能 API 网关

### 30.1 架构设计

```mermaid
graph TB
    subgraph "客户端"
        MOB[移动端] --> GW[API 网关]
        WEB[Web 前端] --> GW
        IOT[IoT 设备] --> GW
    end

    subgraph "API 网关层"
        GW --> RL[速率限制]
        RL --> AUTH[认证鉴权]
        AUTH --> LB[负载均衡]
        LB --> CACHE[响应缓存]
    end

    subgraph "后端服务"
        LB --> S1[用户服务]
        LB --> S2[订单服务]
        LB --> S3[支付服务]
    end
```

### 30.2 网关核心实现

```javascript
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

const app = express();

// 1. 请求日志
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(JSON.stringify({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - start,
      ip: req.ip,
    }));
  });
  next();
});

// 2. 全局限流
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
}));

// 3. 认证中间件
app.use('/api', (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// 4. 代理路由
app.use('/api/users', createProxyMiddleware({
  target: 'http://user-service:3001',
  changeOrigin: true,
  pathRewrite: { '^/api/users': '/users' },
  timeout: 5000,
  proxyTimeout: 5000,
}));

app.use('/api/orders', createProxyMiddleware({
  target: 'http://order-service:3002',
  changeOrigin: true,
  pathRewrite: { '^/api/orders': '/orders' },
}));

// 5. 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(8080, () => console.log('API Gateway on :8080'));
```

> **总结**：本章从 HTTP/3/QUIC、gRPC、GraphQL 到 API 安全、网络调试、性能优化，系统性地覆盖了现代网络协议栈的核心知识。掌握这些内容，你将能够设计和实现高性能、安全可靠的网络应用。
