import { loginAction } from "@/app/(auth)/login/actions";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";

const errorMessages: Record<string, string> = {
  auth: "登录失败，请检查邮箱和密码是否正确。",
  inactive: "当前账号已停用，请联系管理员处理。",
  invalid: "请填写完整且合法的登录信息。"
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorMessage = params.error ? errorMessages[params.error] ?? "登录失败，请稍后再试。" : null;

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
            {errorMessage ? <div className="empty-state">{errorMessage}</div> : null}
            <SubmitButton type="submit" pendingText="登录中...">
              进入工作台
            </SubmitButton>
          </form>
        </CardBody>
      </Card>
    </main>
  );
}
