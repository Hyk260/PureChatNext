import { StatusHomeButton, StatusPage } from '@/components/StatusPage'

const NotFound = () => (
  <StatusPage
    extra={<StatusHomeButton />}
    status='404'
    subTitle={
      <>
        页面不存在
        <br />
        请检查 URL 是否正确
      </>
    }
    title='404'
  />
)

export default NotFound
