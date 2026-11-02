import styles from './ConfirmationPopup.module.css';
import { Button } from '../atoms/Button';
import { createPortal } from 'react-dom';
import PopupBase from '../PopupBase/PopupBase';

type ConfirmationPopupProps = {
  message: string;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

function ConfirmationPopup({ message, isOpen, onConfirm, onCancel }: ConfirmationPopupProps) {
    

  return createPortal(
    <PopupBase
    onCancel={onCancel}
    onConfirm={onConfirm}
    isOpen={isOpen}
    >
        <h2>Warning</h2>
        <p>{message}</p>
        <div className={styles.actions}>
            <Button type="button" onClick={onConfirm}>Confirm</Button>
            <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        </div>
    </PopupBase>,
    document.body,
  );
}

export default ConfirmationPopup;