import React from 'react';

// 类型定义
type FAQItem = {
  id: number;
  question: string;
  answer: string;
};

// 数据源
const faqData: FAQItem[] = [
  {
    id: 1,
    question: "如何使用LanDrop？",
    answer: "运行LanDrop可执行文件即可启动文件共享服务。LanDrop会在本地创建一个服务，同一个局域网内设备可以通过你的局域网ip:80/4321访问；当然你还可以把dns解析到当前客户端设备，那么所有的设备就可以用landrop.go域名进行访问，因为landrop内置了dns服务器。"
  },
  {
    id: 2,
    question: "我能切换分享的目录文件夹吗？",
    answer: "可以的，你可以在客户端的设置中设置需要分享的文件夹。"
  },
  {
    id: 3,
    question: "我只想分享一个文件，并且短期有效该怎么办？",
    answer: "客户端快速分享，选择需要分享的文件，并且设置分享的时效。"
  },
  {
    id: 4,
    question: "私信聊天可以传输文字，还有其他吗？",
    answer: "私信聊天可以传递文字，图片，文件等。"
  },
  {
    id: 5,
    question: "我的客户端以及web端如何更换头像以及用户名称？",
    answer: "客户端可以在左下角设置进行修改，web端仅仅能修改头像，如果需要设置用户名称，您可以直接解绑重新绑定。"
  },
  {
    id: 6,
    question: "我的数据是安全的吗？",
    answer: "您的数据都存储在客户端，并且数据传递是安全的；但是由于是局域网信息分享，所以客户端的权限较高，landrop主要是为了快速的传递信息在局域网内，所以主要功能是为了快捷信息交互。"
  },
  {
    id: 7,
    question: "landrop支持移动端吗？",
    answer: "landrop web端是支持移动端适配的。"
  },
  {
    id: 8,
    question: "landrop后续有支持linux、mac的准备吗？",
    answer: "是的，其他系统还在开发中。"
  }
];

// 问答项组件
const FAQItem: React.FC<{ item: FAQItem; isLast: boolean }> = ({ item, isLast }) => {
  return (
    <div className={`bg-gray-50 p-4 rounded-lg ${!isLast ? 'mb-4' : ''}`}>
      <div className="flex items-start">
        <div className="text-secondary bg-secondary-foreground rounded-full w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">
          <span className="font-medium">Q</span>
        </div>
        <p className="font-semibold text-gray-700">{item.question}</p>
      </div>
      <div className="flex mt-2">
        <div className="text-secondary bg-secondary-foreground rounded-full w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">
          <span className="font-medium">A</span>
        </div>
        <p className="text-gray-600">{item.answer}</p>
      </div>
    </div>
  );
};

// 主组件
const Help = () => {
  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">LanDrop 快捷问答</h1>
      
      <div className="space-y-4">
        {faqData.map((item, index) => (
          <FAQItem 
            key={item.id}
            item={item}
            isLast={index === faqData.length - 1}
          />
        ))}
      </div>
    </div>
  );
};

export default Help;