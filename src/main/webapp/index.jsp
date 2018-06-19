<%@ page contentType="text/html; charset=utf-8" %>
<html>
<head>
    <title>精彩尽在--天涯博客</title>
    <link rel="shortcut icon" href="asserts/images/favicon.ico" type="image/x-icon">
    <!--链接式:推荐使用-->
    <link rel="stylesheet" type="text/css" href="/asserts/css/style.css">
    <%@include file="/asserts/include/taglib.jsp" %>
</head>
<body>
<h2>用户登录</h2>
<div id="login">
    <form action="" method="post">
        <label class="input-tip">用户名：</label><input type="text" id="username" class="username"/><br>
        <label class="input-tip">密码&nbsp;&nbsp;&nbsp;：</label><input type="password" id="password"
                                                                     class="password"/><br>
        <div class="op-button">
            <input type="submit" value="提交" class="input-tip">
            <input type="reset" value="重置" class="input-tip">
        </div>
    </form>
</div>
</body>
</html>
