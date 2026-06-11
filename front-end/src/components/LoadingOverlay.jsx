import { ClipLoader } from "react-spinners";

const LoadingOverlay = ({ isVisible, color = "#000000", size = 50 }) => {
  if (!isVisible) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-50 z-[30000]">
      <ClipLoader color={color} size={size} />
    </div>
  );
};

export default LoadingOverlay;
