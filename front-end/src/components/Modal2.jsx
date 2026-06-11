import { IoClose } from "react-icons/io5";
const Modal2 = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black opacity-50 backdrop-blur-sm z-[20000]"></div>

      <div className="fixed inset-0 flex items-center justify-center z-[20001] px-4">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-auto animate-fadeIn">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 cursor-pointer"
            >
              <IoClose className="text-xl"/>
            </button>
          </div>
          {children}
        </div>
      </div>
    </>
  );
};

export default Modal2;
