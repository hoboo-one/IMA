import { loginAction } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="login-shell">
      <Card className="login-panel">
        <CardHeader>
          <div>
            <p className="eyebrow">Internal Studio</p>
            <CardTitle>登录 Product Storyboard Studio</CardTitle>
          </div>
        </CardHeader>
        <CardBody>
          <form action={loginAction} className="stack-form">
            <label className="field">
              <span>邮箱</span>
              <input name="email" type="email" placeholder="team@example.com" required />
            </label>
            <label className="field">
              <span>密码</span>
              <input name="password" type="password" placeholder="请输入密码" required />
            </label>
            {params.error ? (
              <div className="empty-state">登录失败，请确认账号状态和密码是否正确。</div>
            ) : null}
            <Button type="submit">进入工作台</Button>
          </form>
        </CardBody>
      </Card>
    </main>
  );
}
