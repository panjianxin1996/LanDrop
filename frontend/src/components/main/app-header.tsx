import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useLocation } from 'react-router-dom'
import router from "@/router"
import { Button } from "@/components/ui/button"
import { RotateCw } from "lucide-react"
export function AppHeader() {
  const { pathname } = useLocation();
  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear sticky top-0 bg-white z-50">
      <div className="flex justify-between w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <div className="flex">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mx-2 data-[orientation=vertical]:h-4"
          />
          <h1 className="text-base font-medium">{router?.menuRouter?.find(item => item.path === pathname.split('/').pop())?.title}</h1>
        </div>
        <Button size="sm" variant="outline" className="p-2" onClick={()=> window.location.reload()}>
          <RotateCw size={15}/>
        </Button>
      </div>
    </header>
  )
}
